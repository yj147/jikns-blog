# 安全测试套件

本目录包含完整的安全测试套件，用于验证博客系统的安全防护措施和攻击场景应对能力。

## 📁 测试结构

```
/tests/security/
├── attack-scenarios/          # 攻击场景测试
│   ├── csrf-attacks.test.ts   # CSRF 攻击场景
│   ├── xss-attacks.test.ts    # XSS 攻击场景
│   └── jwt-attacks.test.ts    # JWT 攻击场景
├── edge-cases/                # 边缘案例测试
│   └── rate-limiting-edge-cases.test.ts
├── integration/               # 集成测试
│   ├── security-performance.test.ts
│   └── end-to-end-security.test.ts
├── phase4-basic.test.ts       # 基础功能测试
├── phase4-security.test.ts    # 安全功能测试
└── README.md                  # 本文档
```

## 🎯 测试目标

### 覆盖率目标
- **攻击场景覆盖**: ≥ 90%
- **边缘案例覆盖**: ≥ 85% 
- **集成测试覆盖**: ≥ 95%
- **性能影响评估**: < 10%

### 安全测试维度

#### 1. 攻击场景测试 (`attack-scenarios/`)

**CSRF 攻击防护** (`csrf-attacks.test.ts`)
- 跨站请求伪造攻击模拟
- 令牌重用和篡改攻击
- Origin/Referer 验证绕过
- 双重提交Cookie攻击
- 时序攻击防护
- 自动防护响应测试

**XSS 攻击防护** (`xss-attacks.test.ts`)
- 存储型 XSS 攻击场景
- 反射型 XSS 攻击场景  
- DOM 型 XSS 攻击场景
- 过滤器绕过攻击
- 复杂编码和混淆攻击
- 上下文相关XSS测试

**JWT 攻击防护** (`jwt-attacks.test.ts`)
- 令牌伪造和篡改攻击
- 会话劫持检测
- 令牌重放攻击防护
- 刷新令牌安全测试
- 时序攻击防护
- 签名验证绕过测试

#### 2. 边缘案例测试 (`edge-cases/`)

**速率限制边缘案例** (`rate-limiting-edge-cases.test.ts`)
- 时间窗口边界处理
- 高并发请求场景
- IP地址格式处理
- 内存管理和清理
- 配置异常处理
- 分布式环境支持

#### 3. 集成测试 (`integration/`)

**安全性能影响** (`security-performance.test.ts`)
- JWT 生成/验证性能测试
- XSS 清理性能评估
- 速率限制性能测试
- 完整请求处理性能
- 内存使用稳定性
- 性能基准回归测试

**端到端安全流程** (`end-to-end-security.test.ts`)
- 完整用户认证流程
- 内容发布安全验证
- 管理员操作安全检查
- 多向量攻击防护
- 系统恢复和响应

## 🚀 运行测试

### 单个测试套件
```bash
# 运行攻击场景测试
pnpm test tests/security/attack-scenarios/

# 运行边缘案例测试  
pnpm test tests/security/edge-cases/

# 运行集成测试
pnpm test tests/security/integration/
```

### 完整安全测试
```bash
# 运行所有安全测试
pnpm test tests/security/

# 带覆盖率报告
pnpm test:coverage tests/security/
```

### 性能基准测试
```bash
# 仅运行性能测试
pnpm test tests/security/integration/security-performance.test.ts

# 生成性能报告
pnpm test:perf tests/security/
```

## 📊 测试报告

### 覆盖率指标
- **语句覆盖率**: ≥ 95%
- **分支覆盖率**: ≥ 90%
- **函数覆盖率**: ≥ 95%
- **行覆盖率**: ≥ 95%

### 性能指标
- **JWT 生成**: < 1ms/令牌
- **JWT 验证**: < 0.5ms/令牌
- **XSS 清理**: < 5ms (中等内容)
- **CSRF 验证**: < 1ms/请求
- **完整请求处理**: < 10ms/请求

### 攻击场景覆盖

#### CSRF 攻击 (15+ 场景)
- ✅ 无令牌请求阻止
- ✅ 令牌重用检测
- ✅ 令牌篡改检测
- ✅ 时序攻击防护
- ✅ Origin 验证
- ✅ 子域名攻击防护
- ✅ 状态修改保护
- ✅ 攻击模式识别
- ✅ 自动防护响应

#### XSS 攻击 (20+ 场景)  
- ✅ 存储型 XSS 防护
- ✅ 反射型 XSS 防护
- ✅ DOM 型 XSS 防护
- ✅ 脚本注入阻止
- ✅ 事件处理器清理
- ✅ 协议清理 (javascript:)
- ✅ 编码绕过防护
- ✅ 混淆攻击检测
- ✅ 上下文相关清理
- ✅ 性能DoS防护

#### JWT 攻击 (18+ 场景)
- ✅ 无签名令牌拒绝
- ✅ 算法替换防护
- ✅ 载荷篡改检测
- ✅ 会话劫持检测
- ✅ 令牌重放防护
- ✅ 刷新令牌轮换
- ✅ 时序攻击防护
- ✅ 并发会话限制
- ✅ 异地登录检测

## 🔍 测试数据和工具

### 测试数据生成
```typescript
// XSS 攻击载荷生成器
const generateXSSPayloads = (count: number) => {
  return Array.from({ length: count }, generateRandomXSSPayload)
}

// JWT 令牌生成器
const generateMockTokens = (users: User[]) => {
  return users.map(user => ({
    user,
    accessToken: JWTSecurity.generateAccessToken(...),
    refreshToken: JWTSecurity.generateRefreshToken(...)
  }))
}
```

### 性能监控工具
```typescript
// 性能测量工具
const measurePerformance = async (operation: () => Promise<any>) => {
  const startTime = performance.now()
  await operation()
  return performance.now() - startTime
}

// 内存使用监控
const monitorMemoryUsage = () => {
  const usage = process.memoryUsage()
  return {
    heapUsed: usage.heapUsed / 1024 / 1024, // MB
    heapTotal: usage.heapTotal / 1024 / 1024 // MB
  }
}
```

## 🛡️ 安全配置验证

### 配置检查清单
- ✅ JWT 密钥强度验证 (≥32字符)
- ✅ CSRF 令牌长度检查 (≥16字符)  
- ✅ XSS 过滤器配置验证
- ✅ 速率限制阈值合理性
- ✅ 会话超时配置检查
- ✅ 安全头部配置验证

### 环境特定配置
```typescript
// 开发环境：较宽松的限制
const developmentConfig = {
  jwt: { accessTokenExpiresIn: 15 * 60 }, // 15分钟
  rateLimit: { maxRequests: 1000 },
  xss: { strictMode: false }
}

// 生产环境：严格的限制
const productionConfig = {
  jwt: { accessTokenExpiresIn: 5 * 60 }, // 5分钟
  rateLimit: { maxRequests: 60 },
  xss: { strictMode: true }
}
```

## 📈 持续改进

### 威胁模型更新
- 定期更新攻击场景测试
- 跟踪最新安全漏洞 (CVE)
- 集成安全扫描工具
- 社区安全报告分析

### 性能优化
- 识别性能瓶颈
- 优化关键路径
- 缓存策略改进
- 资源使用优化

### 测试覆盖增强
- 新功能安全测试
- 边缘案例发现
- 集成测试扩展
- 用户场景模拟

## 🚨 告警和监控

### 测试失败处理
```typescript
// 测试失败告警
const handleTestFailure = (testResult: TestResult) => {
  if (testResult.severity === 'CRITICAL') {
    // 立即告警
    sendSecurityAlert(testResult)
  }
  
  // 记录到安全日志
  logSecurityEvent(testResult)
}
```

### 性能回归检测
```typescript
// 性能基准比较
const checkPerformanceRegression = (current: number, baseline: number) => {
  const degradation = (current - baseline) / baseline
  if (degradation > 0.1) { // 性能下降超过10%
    throw new Error(`性能回归: ${degradation * 100}%`)
  }
}
```

## 📚 参考资源

### 安全测试标准
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [SANS Testing Guidelines](https://www.sans.org/white-papers/)

### 工具和框架
- **Vitest**: 测试框架
- **Node.js Crypto**: 加密功能测试
- **Performance API**: 性能测量
- **Memory Usage API**: 内存监控

### 威胁情报
- **OWASP Top 10**: Web应用安全风险
- **CVE Database**: 通用漏洞披露
- **Security Headers**: 安全头部配置
- **JWT Security**: JWT最佳实践

---

**注意**: 所有安全测试都应在隔离环境中运行，避免影响生产系统。测试数据应使用模拟数据，不包含真实敏感信息。