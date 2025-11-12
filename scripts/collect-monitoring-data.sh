#!/bin/bash

FOCUS="all"

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --focus)
      shift
      FOCUS="${1:-all}"
      ;;
    *)
      echo "❌ 未知参数: $1"
      exit 1
      ;;
  esac
  shift || true
done

# 监控数据持续收集脚本
# 用于7天持续收集监控数据，生成最终报告

# 数据存储目录
MONITOR_DATA_DIR="./monitoring-data"
mkdir -p "$MONITOR_DATA_DIR"

# 配置
BASE_URL=${MONITORING_SITE_URL:-${NEXT_PUBLIC_SITE_URL:-"http://localhost:3999"}}
ADMIN_EMAIL=${MONITORING_ADMIN_EMAIL:-"admin@example.com"}
ADMIN_PASSWORD=${MONITORING_ADMIN_PASSWORD:-"admin123456"}
COOKIE_JAR="$MONITOR_DATA_DIR/.monitoring-session.cookies"

function extract_json_field() {
  local field="$1"
  node -e "try { const data = JSON.parse(require('fs').readFileSync(0, 'utf8')); const value = field => field.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), data); const result = value('$field'); if (result === undefined || result === null) process.exit(1); if (typeof result === 'object') console.log(JSON.stringify(result)); else console.log(result); } catch (err) { process.exit(1); }" <<<"$2"
}

function ensure_session() {
  local csrf_response csrf_token login_response login_success

  # 如果已有 cookie，先尝试访问一次监控接口
  if [ -f "$COOKIE_JAR" ]; then
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$BASE_URL/api/monitoring/performance?format=summary")
    if [ "$status" = "200" ]; then
      return
    fi
  fi

  echo "🔐 获取 CSRF 令牌..."
  csrf_response=$(curl -s -c "$COOKIE_JAR" "$BASE_URL/api/csrf-token")
  csrf_token=$(extract_json_field "token" "$csrf_response" 2>/dev/null)
  if [ -z "$csrf_token" ]; then
    echo "❌ 无法获取 CSRF 令牌，响应: $csrf_response"
    exit 1
  fi

  echo "🔑 登录管理员账户 ($ADMIN_EMAIL)..."
  login_response=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "x-csrf-token: $csrf_token" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
    "$BASE_URL/api/auth/login")

  login_success=$(extract_json_field "success" "$login_response" 2>/dev/null)
  if [ "$login_success" != "true" ]; then
    echo "❌ 登录失败，响应: $login_response"
    rm -f "$COOKIE_JAR"
    exit 1
  fi

  echo "✅ 登录成功，已刷新监控会话"
}

ensure_session

# 当前日期
TODAY=$(date +%Y%m%d)
CURRENT_TIME=$(date '+%Y-%m-%d %H:%M:%S')

echo "📊 监控数据收集器"
echo "=================="
echo "时间: $CURRENT_TIME"
echo "数据目录: $MONITOR_DATA_DIR"
echo ""

# 监控端点
METRICS_ENDPOINT="${PREPROD_URL:-http://localhost:3999}/api/monitoring/performance?format=summary"
HEALTH_ENDPOINT="${PREPROD_URL:-http://localhost:3999}/api/monitoring/health"

# 1. 收集当前指标
echo "📈 收集当前指标..."
metrics_file="$MONITOR_DATA_DIR/metrics-$TODAY-$(date +%H%M%S).json"

# 获取指标数据
metrics_response=$(curl -s -b "$COOKIE_JAR" "$METRICS_ENDPOINT" 2>/dev/null || echo '{"error": "无法获取指标"}')

# 添加时间戳
echo "{\"timestamp\": \"$CURRENT_TIME\", \"data\": $metrics_response}" > "$metrics_file"
echo "  ✅ 已保存到: $metrics_file"

# 生成 Posts 指标摘要
raw_post_actions=$(echo "$metrics_response" | jq -c '.data.postActionMetrics' 2>/dev/null)

if [ -z "$raw_post_actions" ] || [ "$raw_post_actions" = "null" ]; then
  post_actions_json="无数据"
  post_actions_summary="无数据"
  post_actions_table="(无数据)"
else
  post_actions_json=$(echo "$raw_post_actions" | jq '.' 2>/dev/null)
  post_actions_summary=$(echo "$raw_post_actions" | jq -r '
    "- 总调用次数: \(.totalActions // 0)" +
    "\n- 失败率: " + (@sprintf("%.2f%%"; (.failureRate // 0)))
  ' 2>/dev/null)

  post_actions_table=$(echo "$raw_post_actions" | jq -r '
    def fmtnum(n): if n == null then "-" else @sprintf("%.0f"; n) end;
    def fmtstr(s): if s == null or s == "" then "-" else s end;
    if (.actions | length) == 0 then "(无数据)" else
      ("| Action | Total | Success | Failure | Avg(ms) | P95(ms) | Last Failure |"),
      ("| --- | ---: | ---: | ---: | ---: | ---: | --- |")
      , (.actions | map(
          "| " + fmtstr(.action) +
          " | " + ((.total // 0) | tostring) +
          " | " + ((.successCount // 0) | tostring) +
          " | " + ((.failureCount // 0) | tostring) +
          " | " + fmtnum(.averageDuration) +
          " | " + fmtnum(.p95Duration) +
          " | " + fmtstr(.lastFailureAt) +
          " |"
        ) | join("\n"))
      | join("\n")
    end
  ' 2>/dev/null)

if [ -z "$post_actions_table" ]; then
  post_actions_table="(无数据)"
fi

# Activity 限流指标
activity_rate_limit_json=$(echo "$metrics_response" | jq -c '.data.activityRateLimitMetrics' 2>/dev/null)

if [ -z "$activity_rate_limit_json" ] || [ "$activity_rate_limit_json" = "null" ]; then
  activity_rate_limit_summary="无速率限制数据"
  activity_rate_limit_table="(无数据)"
else
  activity_rate_limit_summary=$(echo "$activity_rate_limit_json" | jq -r '
    [
      "- 总检查次数: " + ((.totalChecks // 0) | tostring),
      "- 拦截次数: " + ((.blockedCount // 0) | tostring),
      "- 拦截率: " + @sprintf("%.2f%%"; (.blockRate // 0))
    ] | join("\n")
  ' 2>/dev/null)

activity_rate_limit_table=$(echo "$activity_rate_limit_json" | jq -r '
    if (.perType | length) == 0 then "(无数据)" else
      [
        "| 类型 | 检查次数 | 拦截次数 | 拦截率 | 平均剩余额度 |",
        "| --- | ---: | ---: | ---: | ---: |"
      ] +
      (.perType | map(
        "| " + (.type // "-") +
        " | " + ((.total // 0) | tostring) +
        " | " + ((.blocked // 0) | tostring) +
        " | " + @sprintf("%.2f%%"; (.blockRate // 0)) +
        " | " + @sprintf("%.2f"; (.averageRemaining // 0)) +
        " |"
      ))
      | join("\n")
    end
  ' 2>/dev/null)

  if [ -z "$activity_rate_limit_table" ]; then
    activity_rate_limit_table="(无数据)"
  fi
fi

follow_rate_limit_summary="暂无关注限流数据"
follow_rate_limit_table="(无数据)"
follow_rate_limit_json="null"

if [ -n "$activity_rate_limit_json" ] && [ "$activity_rate_limit_json" != "null" ]; then
  follow_rate_limit_json=$(echo "$activity_rate_limit_json" | jq -c '(.perType // []) | map(select(.type | test("^follow")))' 2>/dev/null)

  if [ -n "$follow_rate_limit_json" ] && [ "$follow_rate_limit_json" != "[]" ]; then
    follow_rate_limit_summary=$(echo "$follow_rate_limit_json" | jq -r '
      (map(.total // 0) | add // 0) as $total |
      (map(.blocked // 0) | add // 0) as $blocked |
      (if $total == 0 then 0 else ($blocked / $total * 100) end) as $rate |
      [
        "- 总检查次数: " + ($total | tostring),
        "- 拦截次数: " + ($blocked | tostring),
        "- 拦截率: " + @sprintf("%.2f%%"; $rate)
      ] | join("\n")
    ' 2>/dev/null)

    follow_rate_limit_table=$(echo "$follow_rate_limit_json" | jq -r '
      if length == 0 then "(无数据)" else
        [
          "| 类型 | 检查次数 | 拦截次数 | 拦截率 | 平均剩余额度 |",
          "| --- | ---: | ---: | ---: | ---: |"
        ] +
        (map(
          "| " + (.type // "-") +
          " | " + ((.total // 0) | tostring) +
          " | " + ((.blocked // 0) | tostring) +
          " | " + @sprintf("%.2f%%"; (.blockRate // 0)) +
          " | " + (if .averageRemaining == null then "N/A" else @sprintf("%.2f"; .averageRemaining) end) +
          " |"
        ))
        | join("\n")
      end
    ' 2>/dev/null)
  fi
fi

if [ "$FOCUS" = "follow" ]; then
  echo ""
  echo "🎯 关注限流指标（实时）"
  echo "$follow_rate_limit_summary"
  echo ""
  echo "$follow_rate_limit_table"
fi
fi

# Comment 限流指标
comment_rate_limit_json=$(echo "$metrics_response" | jq -c '.data.commentRateLimitMetrics' 2>/dev/null)

if [ -z "$comment_rate_limit_json" ] || [ "$comment_rate_limit_json" = "null" ]; then
  comment_rate_limit_json="null"
  comment_rate_limit_summary="无速率限制数据"
  comment_rate_limit_table="(无数据)"
else
  comment_rate_limit_summary=$(echo "$comment_rate_limit_json" | jq -r '
    [
      "- 总检查次数: " + ((.totalChecks // 0) | tostring),
      "- 拦截次数: " + ((.blockedCount // 0) | tostring),
      "- 拦截率: " + @sprintf("%.2f%%"; (.blockRate // 0))
    ] | join("\n")
  ' 2>/dev/null)

  comment_rate_limit_table=$(echo "$comment_rate_limit_json" | jq -r '
    if (.perDimension | length) == 0 then "(无数据)" else
      [
        "| Action | Dimension | 检查次数 | 拦截次数 | 拦截率 | 平均剩余额度 | 配置上限 |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: |"
      ] +
      (.perDimension | map(
        "| " + (.action // "-") +
        " | " + (.dimension // "-") +
        " | " + ((.total // 0) | tostring) +
        " | " + ((.blocked // 0) | tostring) +
        " | " + @sprintf("%.2f%%"; (.blockRate // 0)) +
        " | " + (if .averageRemaining == null then "N/A" else @sprintf("%.2f"; .averageRemaining) end) +
        " | " + (if .limit == null then "N/A" else @sprintf("%.0f"; .limit) end) +
        " |"
      ))
      | join("\n")
    end
  ' 2>/dev/null)

  if [ -z "$comment_rate_limit_table" ]; then
    comment_rate_limit_table="(无数据)"
  fi
fi

# Like 限流指标
like_rate_limit_json=$(echo "$metrics_response" | jq -c '.data.likeRateLimitMetrics' 2>/dev/null)

if [ -z "$like_rate_limit_json" ] || [ "$like_rate_limit_json" = "null" ]; then
  like_rate_limit_json="null"
  like_rate_limit_summary="无速率限制数据"
  like_rate_limit_table="(无数据)"
else
  like_rate_limit_summary=$(echo "$like_rate_limit_json" | jq -r '
    [
      "- 总检查次数: " + ((.totalChecks // 0) | tostring),
      "- 拦截次数: " + ((.blockedCount // 0) | tostring),
      "- 拦截率: " + @sprintf("%.2f%%"; (.blockRate // 0))
    ] | join("\n")
  ' 2>/dev/null)

  like_rate_limit_table=$(echo "$like_rate_limit_json" | jq -r '
    if (.perDimension | length) == 0 then "(无数据)" else
      [
        "| Action | Dimension | 检查次数 | 拦截次数 | 拦截率 | 平均剩余额度 | 配置上限 |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: |"
      ] +
      (.perDimension | map(
        "| " + (.action // "-") +
        " | " + (.dimension // "-") +
        " | " + ((.total // 0) | tostring) +
        " | " + ((.blocked // 0) | tostring) +
        " | " + @sprintf("%.2f%%"; (.blockRate // 0)) +
        " | " + (if .averageRemaining == null then "N/A" else @sprintf("%.2f"; .averageRemaining) end) +
        " | " + (if .limit == null then "N/A" else @sprintf("%.0f"; .limit) end) +
        " |"
      ))
      | join("\n")
    end
  ' 2>/dev/null)

  if [ -z "$like_rate_limit_table" ]; then
    like_rate_limit_table="(无数据)"
  fi
fi

# Bookmark 限流指标
bookmark_rate_limit_json=$(echo "$metrics_response" | jq -c '.data.bookmarkRateLimitMetrics' 2>/dev/null)

if [ -z "$bookmark_rate_limit_json" ] || [ "$bookmark_rate_limit_json" = "null" ]; then
  bookmark_rate_limit_json="null"
  bookmark_rate_limit_summary="无速率限制数据"
  bookmark_rate_limit_table="(无数据)"
else
  bookmark_rate_limit_summary=$(echo "$bookmark_rate_limit_json" | jq -r '
    [
      "- 总检查次数: " + ((.totalChecks // 0) | tostring),
      "- 拦截次数: " + ((.blockedCount // 0) | tostring),
      "- 拦截率: " + @sprintf("%.2f%%"; (.blockRate // 0))
    ] | join("\n")
  ' 2>/dev/null)

  bookmark_rate_limit_table=$(echo "$bookmark_rate_limit_json" | jq -r '
    if (.perDimension | length) == 0 then "(无数据)" else
      [
        "| Action | Dimension | 检查次数 | 拦截次数 | 拦截率 | 平均剩余额度 | 配置上限 |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: |"
      ] +
      (.perDimension | map(
        "| " + (.action // "-") +
        " | " + (.dimension // "-") +
        " | " + ((.total // 0) | tostring) +
        " | " + ((.blocked // 0) | tostring) +
        " | " + @sprintf("%.2f%%"; (.blockRate // 0)) +
        " | " + (if .averageRemaining == null then "N/A" else @sprintf("%.2f"; .averageRemaining) end) +
        " | " + (if .limit == null then "N/A" else @sprintf("%.0f"; .limit) end) +
        " |"
      ))
      | join("\n")
    end
  ' 2>/dev/null)

  if [ -z "$bookmark_rate_limit_table" ]; then
    bookmark_rate_limit_table="(无数据)"
  fi
fi

# Activity 搜索指标
activity_search_json=$(echo "$metrics_response" | jq -c '.data.activitySearchMetrics' 2>/dev/null)

if [ -z "$activity_search_json" ] || [ "$activity_search_json" = "null" ]; then
  activity_search_summary="无搜索数据"
else
  activity_search_summary=$(echo "$activity_search_json" | jq -r '
    [
      "- 搜索总次数: " + ((.totalSearches // 0) | tostring),
      "- 平均耗时(ms): " + @sprintf("%.2f"; (.averageDuration // 0)),
      "- P95耗时(ms): " + @sprintf("%.2f"; (.p95Duration // 0)),
      "- 空结果率: " + @sprintf("%.2f%%"; (.emptyResultRate // 0)),
      "- 平均结果数量: " + @sprintf("%.2f"; (.averageResultCount // 0))
    ] | join("\n")
  ' 2>/dev/null)
fi

# 2. 统计历史数据
echo ""
echo "📊 历史数据统计："

# 计算已收集天数
file_count=$(find "$MONITOR_DATA_DIR" -name "metrics-*.json" 2>/dev/null | wc -l)
days_collected=$(find "$MONITOR_DATA_DIR" -name "metrics-*.json" -mtime +0 2>/dev/null | cut -d'-' -f2 | sort -u | wc -l)

echo "  文件数量: $file_count"
echo "  收集天数: $days_collected/7"

# 3. 生成每日摘要
daily_summary_file="$MONITOR_DATA_DIR/daily-summary-$TODAY.md"

cat > "$daily_summary_file" << EOF
# 监控日报 - $TODAY

## 收集时间
$CURRENT_TIME

## 关键指标

### 错误统计
\`\`\`json
$(echo "$metrics_response" | jq '.data.topIssues.topErrors' 2>/dev/null || echo "无数据")
\`\`\`

### Posts 操作指标
\`\`\`json
$(printf "%s" "${post_actions_json}")
\`\`\`

${post_actions_summary}

${post_actions_table}

### Activity 限流指标
\`\`\`json
$(printf "%s" "${activity_rate_limit_json}")
\`\`\`

${activity_rate_limit_summary}

${activity_rate_limit_table}

### Follow 限流指标
\`\`\`json
$(printf "%s" "${follow_rate_limit_json}")
\`\`\`

${follow_rate_limit_summary}

${follow_rate_limit_table}

### Comment 限流指标
\`\`\`json
$(printf "%s" "${comment_rate_limit_json}")
\`\`\`

${comment_rate_limit_summary}

${comment_rate_limit_table}

### Like 限流指标
\`\`\`json
$(printf "%s" "${like_rate_limit_json}")
\`\`\`

${like_rate_limit_summary}

${like_rate_limit_table}

### Bookmark 限流指标
\`\`\`json
$(printf "%s" "${bookmark_rate_limit_json}")
\`\`\`

${bookmark_rate_limit_summary}

${bookmark_rate_limit_table}

### Activity 搜索指标
\`\`\`json
$(printf "%s" "${activity_search_json}")
\`\`\`

${activity_search_summary}

## 趋势分析
- 待7天数据收集完成后生成

## 备注
- 系统运行状态: $(curl -s "$HEALTH_ENDPOINT" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "离线")
- 下次收集: $(date -d '+1 hour' '+%H:%M')
EOF

echo "  ✅ 日报已生成: $daily_summary_file"

# 4. 检查是否满7天
if [ "$days_collected" -ge 7 ]; then
    echo ""
    echo "🎉 已收集满7天数据！生成最终报告..."

    final_report="$MONITOR_DATA_DIR/final-report-$(date +%Y%m%d).md"

    cat > "$final_report" << EOF
# 错误监控7天验证报告

## 概述
- 收集周期: 7天
- 数据点数: $file_count
- 生成时间: $CURRENT_TIME

## 关键发现

### 错误模式
$(find "$MONITOR_DATA_DIR" -name "metrics-*.json" -exec jq -r '.data.errors | to_entries[] | "\(.key): \(.value.count)"' {} \; 2>/dev/null | sort | uniq -c | sort -rn | head -10)

### 报警频率
$(find "$MONITOR_DATA_DIR" -name "metrics-*.json" -exec jq -r '.data.alerts[].code' {} \; 2>/dev/null | sort | uniq -c | sort -rn)

## 阈值调整建议

基于7天数据分析：

| 错误码 | 当前阈值 | 建议阈值 | 理由 |
|--------|---------|---------|------|
| NETWORK_ERROR | 10/分钟 | 待定 | 基于实际数据 |
| VALIDATION_ERROR | 50/5分钟 | 待定 | 基于实际数据 |
| UNKNOWN_ERROR | 5/分钟 | 待定 | 基于实际数据 |

## 误报分析
- 总报警次数: $(find "$MONITOR_DATA_DIR" -name "metrics-*.json" -exec jq '.data.alerts | length' {} \; 2>/dev/null | paste -sd+ | bc 2>/dev/null || echo "0")
- 误报率估算: 待人工审核

## 建议行动

1. **立即调整**
   - 降低高误报率的阈值
   - 提高漏报风险高的阈值

2. **中期优化**
   - 实施动态阈值
   - 添加异常检测算法

3. **长期改进**
   - 建立基线学习机制
   - 实施预测性报警

## 附录

### 原始数据文件
\`\`\`
$(ls -la "$MONITOR_DATA_DIR"/metrics-*.json | tail -20)
\`\`\`

生成时间: $CURRENT_TIME
EOF

    echo "  ✅ 最终报告已生成: $final_report"
    echo ""
    echo "📋 请查看报告并更新监控配置："
    echo "  1. cat $final_report"
    echo "  2. 根据建议调整 lib/observability/error-monitor.ts"
    echo "  3. 部署到生产环境"
fi

# 5. 设置定时任务提醒
echo ""
echo "⏰ 定时收集提醒："
echo ""
echo "  建议添加到 crontab (每小时运行一次):"
echo "  0 * * * * cd $(pwd) && bash scripts/collect-monitoring-data.sh"
echo ""
echo "  或手动运行:"
echo "  watch -n 3600 'bash scripts/collect-monitoring-data.sh'"
echo ""

# 6. 实时监控选项
echo "🔄 实时监控命令："
echo "  tail -f $MONITOR_DATA_DIR/metrics-*.json | jq '.data.errors'"
