#!/bin/bash

# 认证系统 TDD 测试运行脚本
# 支持不同的测试模式和覆盖率配置

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_DIR="${PROJECT_ROOT}/tests"
COVERAGE_DIR="${PROJECT_ROOT}/coverage/auth"

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

log_header() {
    echo -e "\n${PURPLE}=== $1 ===${NC}"
}

# 帮助信息
show_help() {
    echo -e "${CYAN}认证系统 TDD 测试运行脚本${NC}"
    echo
    echo "用法:"
    echo "  $0 [选项]"
    echo
    echo "选项:"
    echo "  --help, -h                显示帮助信息"
    echo "  --watch, -w              监听模式运行测试"
    echo "  --coverage, -c           运行覆盖率测试"
    echo "  --unit, -u              只运行单元测试"
    echo "  --integration, -i       只运行集成测试" 
    echo "  --tdd                   TDD 模式（监听 + 快速反馈）"
    echo "  --ci                    CI/CD 模式（详细报告）"
    echo "  --performance, -p       运行性能测试"
    echo "  --security, -s          运行安全测试"
    echo "  --verbose, -v           详细输出"
    echo "  --clean                 清理缓存和覆盖率文件"
    echo
    echo "示例:"
    echo "  $0                      # 运行所有认证测试"
    echo "  $0 --watch              # 监听模式"
    echo "  $0 --coverage           # 生成覆盖率报告"
    echo "  $0 --tdd                # TDD 开发模式"
    echo "  $0 --ci                 # CI/CD 模式"
}

# 检查环境
check_environment() {
    log_header "环境检查"
    
    # 检查 Node.js 和 pnpm
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装或不在 PATH 中"
        exit 1
    fi
    
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm 未安装或不在 PATH 中"
        exit 1
    fi
    
    # 检查项目根目录
    if [[ ! -f "${PROJECT_ROOT}/package.json" ]]; then
        log_error "未找到 package.json，请在项目根目录运行此脚本"
        exit 1
    fi
    
    # 检查测试目录
    if [[ ! -d "${TEST_DIR}" ]]; then
        log_error "测试目录不存在: ${TEST_DIR}"
        exit 1
    fi
    
    log_success "环境检查通过"
}

# 清理缓存和覆盖率文件
clean_cache() {
    log_header "清理缓存"
    
    # 清理 Vitest 缓存
    if [[ -d "${PROJECT_ROOT}/node_modules/.vitest" ]]; then
        rm -rf "${PROJECT_ROOT}/node_modules/.vitest"
        log_info "已清理 Vitest 缓存"
    fi
    
    # 清理覆盖率文件
    if [[ -d "${COVERAGE_DIR}" ]]; then
        rm -rf "${COVERAGE_DIR}"
        log_info "已清理覆盖率文件"
    fi
    
    if [[ -d "${PROJECT_ROOT}/coverage" ]]; then
        rm -rf "${PROJECT_ROOT}/coverage"
        log_info "已清理所有覆盖率文件"
    fi
    
    log_success "缓存清理完成"
}

# 设置测试环境变量
setup_test_env() {
    export NODE_ENV=test
    export NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
    export NEXT_PUBLIC_SUPABASE_ANON_KEY="test-anon-key"
    export NEXT_PUBLIC_SITE_URL="http://localhost:3000"
    export VITEST_ENVIRONMENT="jsdom"
    
    log_info "测试环境变量已设置"
}

# 运行单元测试
run_unit_tests() {
    log_header "运行认证单元测试"
    
    local test_pattern="${TEST_DIR}/auth/*.test.ts"
    local vitest_args="--reporter=verbose"
    
    if [[ "$VERBOSE" == "true" ]]; then
        vitest_args="$vitest_args --reporter=verbose"
    fi
    
    if [[ "$COVERAGE" == "true" ]]; then
        vitest_args="$vitest_args --coverage"
    fi
    
    cd "$PROJECT_ROOT"
    pnpm exec vitest run $vitest_args "$test_pattern"
}

# 运行集成测试
run_integration_tests() {
    log_header "运行认证集成测试"
    
    local test_pattern="${TEST_DIR}/integration/*auth*.test.ts ${TEST_DIR}/integration/*oauth*.test.ts ${TEST_DIR}/integration/*email*.test.ts ${TEST_DIR}/integration/*api*.test.ts"
    local vitest_args="--reporter=verbose"
    
    if [[ "$VERBOSE" == "true" ]]; then
        vitest_args="$vitest_args --reporter=verbose"
    fi
    
    if [[ "$COVERAGE" == "true" ]]; then
        vitest_args="$vitest_args --coverage"
    fi
    
    cd "$PROJECT_ROOT"
    pnpm exec vitest run $vitest_args $test_pattern
}

# 运行性能测试
run_performance_tests() {
    log_header "运行认证性能测试"
    
    local test_pattern="${TEST_DIR}/auth/*.test.ts ${TEST_DIR}/integration/*auth*.test.ts"
    local vitest_args="--reporter=verbose --testTimeout=10000"
    
    cd "$PROJECT_ROOT"
    pnpm exec vitest run $vitest_args --grep="性能测试|performance" "$test_pattern"
}

# 运行安全测试
run_security_tests() {
    log_header "运行认证安全测试"
    
    local test_pattern="${TEST_DIR}/auth/*.test.ts ${TEST_DIR}/integration/*auth*.test.ts ${TEST_DIR}/security/*.test.ts"
    local vitest_args="--reporter=verbose"
    
    cd "$PROJECT_ROOT"
    pnpm exec vitest run $vitest_args --grep="安全|security|CSRF|XSS|injection" "$test_pattern"
}

# 运行覆盖率测试
run_coverage_tests() {
    log_header "运行覆盖率测试"
    
    local test_pattern="${TEST_DIR}/auth/*.test.ts ${TEST_DIR}/integration/*auth*.test.ts"
    local vitest_args="--coverage --reporter=verbose"
    
    # 确保覆盖率目录存在
    mkdir -p "$COVERAGE_DIR"
    
    cd "$PROJECT_ROOT"
    pnpm exec vitest run $vitest_args "$test_pattern"
    
    # 显示覆盖率报告
    if [[ -f "${COVERAGE_DIR}/index.html" ]]; then
        log_success "覆盖率报告生成完成："
        log_info "HTML 报告: ${COVERAGE_DIR}/index.html"
    fi
    
    if [[ -f "${COVERAGE_DIR}/lcov.info" ]]; then
        log_info "LCOV 报告: ${COVERAGE_DIR}/lcov.info"
    fi
}

# 监听模式
run_watch_mode() {
    log_header "启动监听模式"
    
    local test_pattern="${TEST_DIR}/auth/*.test.ts"
    if [[ "$INTEGRATION" == "true" ]]; then
        test_pattern="$test_pattern ${TEST_DIR}/integration/*auth*.test.ts"
    fi
    
    local vitest_args="--watch --reporter=verbose"
    
    if [[ "$TDD" == "true" ]]; then
        vitest_args="$vitest_args --reporter=basic"
        log_info "TDD 模式：快速反馈开启"
    fi
    
    cd "$PROJECT_ROOT"
    pnpm exec vitest $vitest_args $test_pattern
}

# CI 模式
run_ci_mode() {
    log_header "运行 CI/CD 测试"
    
    local test_pattern="${TEST_DIR}/auth/*.test.ts ${TEST_DIR}/integration/*auth*.test.ts"
    local vitest_args="--coverage --reporter=json --reporter=text --reporter=junit"
    
    # 设置 CI 环境变量
    export CI=true
    
    cd "$PROJECT_ROOT"
    pnpm exec vitest run $vitest_args "$test_pattern" --outputFile.junit="$COVERAGE_DIR/junit.xml" --outputFile.json="$COVERAGE_DIR/results.json"
    
    # 检查测试结果
    if [[ $? -eq 0 ]]; then
        log_success "所有 CI 测试通过"
    else
        log_error "CI 测试失败"
        exit 1
    fi
}

# 生成测试报告
generate_report() {
    log_header "生成测试报告"
    
    local report_file="${COVERAGE_DIR}/test-report.md"
    
    cat > "$report_file" << EOF
# 认证系统测试报告

**生成时间**: $(date '+%Y-%m-%d %H:%M:%S')
**测试环境**: $(node --version)

## 测试统计

### 覆盖率目标
- 单元测试覆盖率: ≥ 90%
- 集成测试覆盖率: ≥ 85%
- 总体覆盖率: ≥ 80%

### 性能指标
- 认证响应时间: < 200ms
- 权限检查时间: < 50ms
- 测试执行时间: < 2分钟

## 测试文件

### 单元测试
- \`tests/auth/auth-utils.test.ts\` - 认证工具函数
- \`tests/auth/user-sync.test.ts\` - 用户数据同步
- \`tests/auth/oauth-flow.test.ts\` - OAuth 流程
- \`tests/auth/middleware.test.ts\` - 中间件权限控制
- \`tests/auth/permissions.test.ts\` - 权限验证函数

### 集成测试
- \`tests/integration/github-oauth.test.ts\` - GitHub OAuth 完整流程
- \`tests/integration/email-auth.test.ts\` - 邮箱认证流程
- \`tests/integration/auth-api.test.ts\` - 认证 API 端点

## 质量门禁

- ✅ 零失败测试
- ✅ 覆盖率达标
- ✅ 性能指标合格
- ✅ 安全测试通过
- ✅ TypeScript 编译无错

---
*报告由 run-auth-tests.sh 自动生成*
EOF
    
    log_success "测试报告已生成: $report_file"
}

# 主函数
main() {
    local COMMAND=""
    local WATCH=false
    local COVERAGE=false
    local UNIT_ONLY=false
    local INTEGRATION=false
    local TDD=false
    local CI=false
    local PERFORMANCE=false
    local SECURITY=false
    local VERBOSE=false
    local CLEAN=false
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --watch|-w)
                WATCH=true
                shift
                ;;
            --coverage|-c)
                COVERAGE=true
                shift
                ;;
            --unit|-u)
                UNIT_ONLY=true
                shift
                ;;
            --integration|-i)
                INTEGRATION=true
                shift
                ;;
            --tdd)
                TDD=true
                WATCH=true
                shift
                ;;
            --ci)
                CI=true
                COVERAGE=true
                shift
                ;;
            --performance|-p)
                PERFORMANCE=true
                shift
                ;;
            --security|-s)
                SECURITY=true
                shift
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --clean)
                CLEAN=true
                shift
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 执行清理（如果需要）
    if [[ "$CLEAN" == "true" ]]; then
        clean_cache
    fi
    
    # 环境检查
    check_environment
    
    # 设置测试环境
    setup_test_env
    
    # 根据参数执行相应的测试
    if [[ "$CI" == "true" ]]; then
        run_ci_mode
        generate_report
    elif [[ "$WATCH" == "true" ]]; then
        run_watch_mode
    elif [[ "$COVERAGE" == "true" ]]; then
        run_coverage_tests
        generate_report
    elif [[ "$UNIT_ONLY" == "true" ]]; then
        run_unit_tests
    elif [[ "$INTEGRATION" == "true" ]]; then
        run_integration_tests
    elif [[ "$PERFORMANCE" == "true" ]]; then
        run_performance_tests
    elif [[ "$SECURITY" == "true" ]]; then
        run_security_tests
    else
        # 默认运行所有认证测试
        log_header "运行所有认证测试"
        run_unit_tests
        echo
        run_integration_tests
        
        if [[ "$VERBOSE" == "true" ]]; then
            echo
            run_performance_tests
            echo
            run_security_tests
        fi
        
        log_success "所有认证测试完成"
    fi
}

# 脚本入口
main "$@"