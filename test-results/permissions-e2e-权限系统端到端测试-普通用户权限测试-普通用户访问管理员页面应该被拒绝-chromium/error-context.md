# Page snapshot

```yaml
- generic [active] [ref=e1]:
    - generic [ref=e3]:
        - link "现代博客" [ref=e5] [cursor=pointer]:
            - /url: /
            - img [ref=e7] [cursor=pointer]
            - generic [ref=e12] [cursor=pointer]: 现代博客
        - generic [ref=e13]:
            - generic [ref=e14]:
                - generic [ref=e15]: 欢迎回来
                - generic [ref=e16]: 选择您偏好的登录方式继续使用
            - generic [ref=e19]:
                - button "使用 GitHub 登录" [ref=e20]:
                    - img
                    - text: 使用 GitHub 登录
                - button "使用邮箱登录" [ref=e21]:
                    - img
                    - text: 使用邮箱登录
        - paragraph [ref=e22]:
            - text: 还没有账户？
            - link "立即注册" [ref=e23] [cursor=pointer]:
                - /url: /register
        - paragraph [ref=e24]:
            - text: 登录即表示您同意我们的
            - link "服务条款" [ref=e25] [cursor=pointer]:
                - /url: /terms
            - text: 和
            - link "隐私政策" [ref=e26] [cursor=pointer]:
                - /url: /privacy
    - region "Notifications (F8)":
        - list
    - button "Open Next.js Dev Tools" [ref=e32] [cursor=pointer]:
        - img [ref=e33] [cursor=pointer]
    - alert [ref=e36]
```
