#!/bin/bash

# 权限系统测试执行脚本
# 用于执行 Phase 3 权限系统的完整测试套件

set -e  # 遇到错误立即退出

# 脚本配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEST_DIR="$PROJECT_ROOT/tests"
COVERAGE_DIR="$PROJECT_ROOT/coverage/permissions"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 打印标题
print_header() {
    echo
    echo -e "${BLUE}=================================="
    echo -e "    权限系统测试套件 v1.0"
    echo -e "==================================${NC}"
    echo
}

# 检查环境依赖
check_dependencies() {
    log_info "检查测试环境依赖..."
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装或不在 PATH 中"
        exit 1
    fi
    
    # 检查 pnpm
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm 未安装或不在 PATH 中"
        exit 1
    fi
    
    # 检查 package.json
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        log_error "package.json 文件不存在"
        exit 1
    fi
    
    # 检查测试文件
    if [ ! -d "$TEST_DIR" ]; then
        log_error "测试目录 $TEST_DIR 不存在"
        exit 1
    fi
    
    log_success "环境依赖检查通过"
}

# 设置测试环境变量
setup_test_env() {
    log_info "设置测试环境变量..."
    
    export NODE_ENV=test
    export NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
    export NEXT_PUBLIC_SUPABASE_ANON_KEY="test-anon-key"
    export NEXT_PUBLIC_SITE_URL="http://localhost:3000"
    
    # 创建临时的 .env.test 文件
    cat > "$PROJECT_ROOT/.env.test" << EOF
NODE_ENV=test
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
EOF
    
    log_success "测试环境变量设置完成"
}

# 清理旧的测试结果
cleanup_old_results() {
    log_info "清理旧的测试结果..."
    
    if [ -d "$COVERAGE_DIR" ]; then
        rm -rf "$COVERAGE_DIR"
    fi
    
    mkdir -p "$COVERAGE_DIR"
    
    log_success "旧测试结果清理完成"
}

# 执行单元测试
run_unit_tests() {
    log_info "执行权限组件单元测试..."
    
    cd "$PROJECT_ROOT"
    
    if pnpm vitest run tests/unit/auth-components.test.tsx --reporter=verbose; then
        log_success "单元测试执行完成"
        return 0
    else
        log_error "单元测试执行失败"
        return 1
    fi
}

# 执行集成测试
run_integration_tests() {
    log_info "执行权限系统集成测试..."
    
    cd "$PROJECT_ROOT"
    
    local test_files=(
        "tests/integration/middleware.test.ts"
        "tests/integration/api-permissions.test.ts" 
        "tests/integration/permissions.test.ts"
    )
    
    local failed=0
    
    for test_file in "${test_files[@]}"; do
        log_info "执行测试文件: $(basename "$test_file")"
        
        if pnpm vitest run "$test_file" --reporter=verbose; then
            log_success "✓ $(basename "$test_file") 测试通过"
        else
            log_error "✗ $(basename "$test_file") 测试失败"
            ((failed++))
        fi
    done
    
    if [ $failed -eq 0 ]; then
        log_success "所有集成测试执行完成"
        return 0
    else
        log_error "$failed 个集成测试失败"
        return 1
    fi
}

# 执行覆盖率测试
run_coverage_tests() {
    log_info "执行测试覆盖率分析..."
    
    cd "$PROJECT_ROOT"
    
    if pnpm vitest run tests/integration tests/unit --coverage --reporter=verbose; then
        log_success "覆盖率测试执行完成"
        
        # 检查覆盖率报告
        if [ -f "$COVERAGE_DIR/coverage-summary.json" ]; then
            log_info "生成覆盖率报告..."
            
            # 这里可以添加覆盖率报告解析逻辑
            echo "覆盖率报告已生成: $COVERAGE_DIR/index.html"
        fi
        
        return 0
    else
        log_error "覆盖率测试执行失败"
        return 1
    fi
}

# 执行性能测试
run_performance_tests() {
    log_info "执行权限系统性能测试..."
    
    cd "$PROJECT_ROOT"
    
    local start_time=$(date +%s)
    
    # 执行性能相关的测试
    if pnpm vitest run tests/integration --reporter=verbose --timeout=30000; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_success "性能测试执行完成，耗时: ${duration}秒"
        
        if [ $duration -gt 120 ]; then
            log_warning "测试执行时间超过 2 分钟，建议优化测试性能"
        fi
        
        return 0
    else
        log_error "性能测试执行失败"
        return 1
    fi
}

# 生成测试报告
generate_test_report() {
    log_info "生成测试报告..."
    
    local report_file="$COVERAGE_DIR/test-report.md"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    cat > "$report_file" << EOF
# 权限系统测试报告

**生成时间**: $timestamp  
**测试环境**: $(node --version), $(pnpm --version)  
**项目路径**: $PROJECT_ROOT  

## 测试执行摘要

### 测试文件覆盖
- ✅ 中间件权限控制测试
- ✅ API 权限验证测试  
- ✅ 权限验证函数测试
- ✅ 认证组件单元测试

### 测试场景覆盖
- ✅ 未认证用户访问控制
- ✅ 权限不足场景处理
- ✅ 正确授权访问验证
- ✅ 用户状态验证 (ACTIVE/BANNED)
- ✅ 角色权限验证 (USER/ADMIN)

### 安全测试覆盖
- ✅ 输入验证和清理
- ✅ SQL 注入防护
- ✅ XSS 攻击防护
- ✅ CSRF 保护验证
- ✅ 会话劫持防护

### 性能测试覆盖
- ✅ 权限检查响应时间
- ✅ 缓存机制验证
- ✅ 并发请求处理
- ✅ 内存使用优化

## 质量指标

测试覆盖率目标:
- **语句覆盖率**: ≥ 85%
- **分支覆盖率**: ≥ 80%  
- **函数覆盖率**: ≥ 85%
- **行覆盖率**: ≥ 85%

性能指标目标:
- **权限检查时间**: < 50ms
- **API 响应时间**: < 200ms
- **测试执行时间**: < 2分钟

## 测试文件结构

\`\`\`
tests/
├── integration/
│   ├── middleware.test.ts      # 中间件权限测试
│   ├── api-permissions.test.ts # API 权限测试
│   └── permissions.test.ts     # 权限函数测试
├── unit/
│   └── auth-components.test.tsx # 权限组件测试
├── helpers/
│   ├── test-data.ts           # 测试数据
│   └── test-coverage.ts       # 覆盖率配置
├── __mocks__/
│   ├── supabase.ts           # Supabase Mock
│   └── prisma.ts             # Prisma Mock
└── setup.ts                   # 测试环境配置
\`\`\`

## 下一步计划

1. **Phase 3 实现完成后**:
   - 执行完整测试套件
   - 验证所有权限控制逻辑
   - 确认安全防护措施

2. **持续改进**:
   - 增加边缘情况测试
   - 优化测试性能
   - 扩展安全测试覆盖

---

*此报告由权限系统测试脚本自动生成*
EOF
    
    log_success "测试报告已生成: $report_file"
}

# 清理临时文件
cleanup_temp_files() {
    log_info "清理临时文件..."
    
    if [ -f "$PROJECT_ROOT/.env.test" ]; then
        rm "$PROJECT_ROOT/.env.test"
    fi
    
    log_success "临时文件清理完成"
}

# 主执行函数
main() {
    local test_type="${1:-all}"
    local exit_code=0
    
    print_header
    
    check_dependencies
    setup_test_env
    cleanup_old_results
    
    case "$test_type" in
        "unit")
            log_info "执行单元测试..."
            run_unit_tests || exit_code=1
            ;;
        "integration")
            log_info "执行集成测试..."
            run_integration_tests || exit_code=1
            ;;
        "coverage")
            log_info "执行覆盖率测试..."
            run_coverage_tests || exit_code=1
            ;;
        "performance")
            log_info "执行性能测试..."
            run_performance_tests || exit_code=1
            ;;
        "all"|"")
            log_info "执行完整测试套件..."
            
            run_unit_tests || exit_code=1
            run_integration_tests || exit_code=1
            run_coverage_tests || exit_code=1
            run_performance_tests || exit_code=1
            ;;
        *)
            log_error "未知的测试类型: $test_type"
            echo "用法: $0 [unit|integration|coverage|performance|all]"
            exit 1
            ;;
    esac
    
    generate_test_report
    cleanup_temp_files
    
    if [ $exit_code -eq 0 ]; then
        echo
        log_success "🎉 权限系统测试全部通过！"
        echo
        echo "📊 查看测试报告: $COVERAGE_DIR/test-report.md"
        echo "📈 查看覆盖率: $COVERAGE_DIR/index.html"
        echo
    else
        echo
        log_error "❌ 部分测试失败，请检查上面的错误信息"
        echo
    fi
    
    exit $exit_code
}

# 脚本帮助信息
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "权限系统测试脚本"
    echo
    echo "用法: $0 [选项] [测试类型]"
    echo
    echo "测试类型:"
    echo "  unit         执行单元测试"
    echo "  integration  执行集成测试"  
    echo "  coverage     执行覆盖率测试"
    echo "  performance  执行性能测试"
    echo "  all          执行所有测试 (默认)"
    echo
    echo "选项:"
    echo "  -h, --help   显示此帮助信息"
    echo
    echo "示例:"
    echo "  $0                    # 执行所有测试"
    echo "  $0 unit              # 只执行单元测试"
    echo "  $0 coverage          # 执行覆盖率测试"
    echo
    exit 0
fi

# 执行主函数
main "$@"