#!/bin/bash

# Phase 2 认证系统测试执行脚本
# 提供 TDD 模式的测试运行和监控

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印彩色输出
print_color() {
    printf "${1}${2}${NC}\n"
}

print_header() {
    echo "=================================================="
    print_color $BLUE "$1"
    echo "=================================================="
}

print_success() {
    print_color $GREEN "✅ $1"
}

print_warning() {
    print_color $YELLOW "⚠️  $1"
}

print_error() {
    print_color $RED "❌ $1"
}

# 检查必要的命令
check_requirements() {
    print_header "检查测试环境"
    
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm 未安装，请先安装 pnpm"
        exit 1
    fi
    print_success "pnpm 已安装"
    
    if ! command -v psql &> /dev/null; then
        print_warning "PostgreSQL 客户端未找到，数据库连接测试可能失败"
    else
        print_success "PostgreSQL 客户端已安装"
    fi
    
    # 检查环境变量
    if [ -z "$DATABASE_URL" ] && [ ! -f ".env.local" ]; then
        print_warning "未找到 DATABASE_URL 环境变量或 .env.local 文件"
        print_color $YELLOW "建议创建 .env.local 文件配置测试环境"
    fi
}

# 准备测试环境
setup_test_env() {
    print_header "准备测试环境"
    
    # 确保测试目录存在
    mkdir -p tests/coverage
    mkdir -p tests/reports
    
    # 设置测试环境变量
    export NODE_ENV=test
    export VITEST_QUIET=${VITEST_QUIET:-true}
    
    print_success "测试环境已准备完毕"
}

# 运行基础验证测试
run_basic_verification() {
    print_header "运行基础验证测试"
    
    echo "检查测试配置..."
    if pnpm vitest run tests/auth/basic-verification.test.ts --reporter=verbose 2>/dev/null; then
        print_success "基础验证测试通过"
    else
        print_error "基础验证测试失败"
        return 1
    fi
}

# 运行完整认证测试套件
run_full_auth_tests() {
    print_header "运行完整认证测试套件"
    
    local test_files=(
        "tests/integration/auth-flow.test.ts"
        "tests/integration/session-management.test.ts" 
        "tests/integration/user-sync.test.ts"
        "tests/integration/config-error-handling.test.ts"
    )
    
    local failed_tests=()
    local passed_tests=()
    
    for test_file in "${test_files[@]}"; do
        echo ""
        print_color $BLUE "运行: $(basename "$test_file")"
        
        if pnpm vitest run "$test_file" --reporter=verbose; then
            passed_tests+=("$test_file")
            print_success "$(basename "$test_file") 测试通过"
        else
            failed_tests+=("$test_file")
            print_error "$(basename "$test_file") 测试失败"
        fi
    done
    
    echo ""
    print_header "测试结果汇总"
    print_color $GREEN "通过的测试: ${#passed_tests[@]}"
    print_color $RED "失败的测试: ${#failed_tests[@]}"
    
    if [ ${#failed_tests[@]} -gt 0 ]; then
        echo ""
        print_color $RED "失败的测试文件:"
        for failed_test in "${failed_tests[@]}"; do
            echo "  - $(basename "$failed_test")"
        done
        return 1
    fi
    
    return 0
}

# 生成测试覆盖率报告
generate_coverage_report() {
    print_header "生成测试覆盖率报告"
    
    echo "运行覆盖率测试..."
    if pnpm vitest run tests/auth/ --coverage --reporter=json --reporter=text > tests/reports/coverage-report.txt 2>&1; then
        print_success "覆盖率报告已生成"
        
        # 显示简化的覆盖率信息
        if [ -f "coverage/coverage-summary.json" ]; then
            echo ""
            print_color $BLUE "覆盖率摘要:"
            # 这里可以添加解析 coverage-summary.json 的逻辑
            cat tests/reports/coverage-report.txt | grep -A 10 "Coverage report"
        fi
    else
        print_error "覆盖率报告生成失败"
        return 1
    fi
}

# TDD 监听模式
run_tdd_mode() {
    print_header "启动 TDD 监听模式"
    
    print_color $BLUE "文件变化时将自动重新运行相关测试"
    print_color $YELLOW "按 'q' 退出监听模式"
    
    # 启动 Vitest 监听模式
    pnpm vitest watch tests/auth/ --reporter=verbose
}

# 运行特定测试文件
run_specific_test() {
    local test_file="$1"
    
    if [ ! -f "$test_file" ]; then
        print_error "测试文件不存在: $test_file"
        return 1
    fi
    
    print_header "运行特定测试: $(basename "$test_file")"
    
    pnpm vitest run "$test_file" --reporter=verbose
}

# 清理测试环境
cleanup_test_env() {
    print_header "清理测试环境"
    
    # 清理临时文件
    rm -f tests/reports/temp-*.txt
    rm -f tests/coverage/tmp-*
    
    print_success "测试环境已清理"
}

# 显示帮助信息
show_help() {
    echo "Phase 2 认证系统测试脚本"
    echo ""
    echo "用法:"
    echo "  $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help          显示此帮助信息"
    echo "  -b, --basic         运行基础验证测试"
    echo "  -f, --full          运行完整测试套件"
    echo "  -c, --coverage      生成覆盖率报告"
    echo "  -w, --watch         启动 TDD 监听模式"
    echo "  -t, --test FILE     运行特定测试文件"
    echo "  -a, --all           运行所有测试（基础+完整+覆盖率）"
    echo "  --cleanup           清理测试环境"
    echo ""
    echo "示例:"
    echo "  $0 --basic                                   # 快速验证"
    echo "  $0 --full                                    # 完整测试"
    echo "  $0 --coverage                                # 覆盖率测试"
    echo "  $0 --watch                                   # TDD 模式"
    echo "  $0 --test tests/integration/auth-flow.test.ts # 特定测试"
    echo "  $0 --all                                     # 全部测试"
}

# 主函数
main() {
    # 解析命令行参数
    case "${1:-}" in
        -h|--help)
            show_help
            exit 0
            ;;
        -b|--basic)
            check_requirements
            setup_test_env
            run_basic_verification
            ;;
        -f|--full)
            check_requirements
            setup_test_env
            run_full_auth_tests
            ;;
        -c|--coverage)
            check_requirements
            setup_test_env
            generate_coverage_report
            ;;
        -w|--watch)
            check_requirements
            setup_test_env
            run_tdd_mode
            ;;
        -t|--test)
            if [ -z "${2:-}" ]; then
                print_error "请指定测试文件路径"
                show_help
                exit 1
            fi
            check_requirements
            setup_test_env
            run_specific_test "$2"
            ;;
        -a|--all)
            check_requirements
            setup_test_env
            
            echo ""
            if run_basic_verification; then
                echo ""
                if run_full_auth_tests; then
                    echo ""
                    generate_coverage_report
                    echo ""
                    print_success "所有测试完成！"
                else
                    print_error "完整测试套件失败"
                    exit 1
                fi
            else
                print_error "基础验证测试失败"
                exit 1
            fi
            ;;
        --cleanup)
            cleanup_test_env
            ;;
        "")
            # 默认行为：运行完整测试套件
            print_color $YELLOW "未指定选项，运行完整测试套件"
            check_requirements
            setup_test_env
            run_full_auth_tests
            ;;
        *)
            print_error "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
}

# 捕获退出信号，确保清理
trap cleanup_test_env EXIT

# 运行主函数
main "$@"