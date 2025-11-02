"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { Github, Mail, Eye, EyeOff, PenTool, Check, X } from "lucide-react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const getPasswordStrength = (password: string) => {
    const checks = [
      { label: "至少8个字符", valid: password.length >= 8 },
      { label: "包含大写字母", valid: /[A-Z]/.test(password) },
      { label: "包含小写字母", valid: /[a-z]/.test(password) },
      { label: "包含数字", valid: /\d/.test(password) },
      { label: "包含特殊字符", valid: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    ]
    return checks
  }

  const passwordChecks = getPasswordStrength(password)
  const passwordsMatch = password && confirmPassword && password === confirmPassword

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <motion.div
        className="w-full max-w-md space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Link href="/" className="inline-flex items-center space-x-2">
            <motion.div
              className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-lg"
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <PenTool className="h-5 w-5" />
            </motion.div>
            <span className="text-2xl font-bold">现代博客</span>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-card/50 border-0 shadow-2xl backdrop-blur-sm">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">创建账户</CardTitle>
              <CardDescription>加入我们的社区，开始你的创作之旅</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Social Register */}
              <motion.div
                className="space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    className="hover:bg-accent/50 w-full bg-transparent transition-all duration-200"
                  >
                    <Github className="mr-2 h-4 w-4" />
                    使用 GitHub 注册
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    className="hover:bg-accent/50 w-full bg-transparent transition-all duration-200"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    使用 Google 注册
                  </Button>
                </motion.div>
              </motion.div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background text-muted-foreground px-2">或者</span>
                </div>
              </div>

              {/* Register Form */}
              <motion.form
                className="space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <motion.div
                  className="grid grid-cols-2 gap-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.5 }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="firstName">姓</Label>
                    <Input
                      id="firstName"
                      placeholder="张"
                      required
                      className="focus:ring-primary/20 transition-all duration-200 focus:ring-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">名</Label>
                    <Input
                      id="lastName"
                      placeholder="三"
                      required
                      className="focus:ring-primary/20 transition-all duration-200 focus:ring-2"
                    />
                  </div>
                </motion.div>

                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.6 }}
                >
                  <Label htmlFor="username">用户名</Label>
                  <Input
                    id="username"
                    placeholder="选择一个独特的用户名"
                    required
                    className="focus:ring-primary/20 transition-all duration-200 focus:ring-2"
                  />
                </motion.div>

                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.7 }}
                >
                  <Label htmlFor="email">邮箱地址</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="输入你的邮箱地址"
                    required
                    className="focus:ring-primary/20 transition-all duration-200 focus:ring-2"
                  />
                </motion.div>

                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.8 }}
                >
                  <Label htmlFor="password">密码</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="创建一个强密码"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="focus:ring-primary/20 transition-all duration-200 focus:ring-2"
                    />
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </motion.div>
                  </div>

                  <AnimatePresence>
                    {password && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 space-y-2"
                      >
                        <div className="text-muted-foreground text-xs">密码强度要求：</div>
                        <div className="space-y-1">
                          {passwordChecks.map((check, index) => (
                            <motion.div
                              key={check.label}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className={`flex items-center space-x-2 text-xs ${
                                check.valid ? "text-green-600" : "text-muted-foreground"
                              }`}
                            >
                              {check.valid ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                              <span>{check.label}</span>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.9 }}
                >
                  <Label htmlFor="confirmPassword">确认密码</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="再次输入密码"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`focus:ring-primary/20 transition-all duration-200 focus:ring-2 ${
                        confirmPassword && !passwordsMatch ? "border-red-500" : ""
                      }`}
                    />
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </motion.div>
                  </div>

                  <AnimatePresence>
                    {confirmPassword && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`flex items-center space-x-2 text-xs ${
                          passwordsMatch ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {passwordsMatch ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        <span>{passwordsMatch ? "密码匹配" : "密码不匹配"}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                <motion.div
                  className="flex items-center space-x-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 1.0 }}
                >
                  <Checkbox id="terms" required />
                  <Label htmlFor="terms" className="text-sm">
                    我同意{" "}
                    <Link href="/terms" className="text-primary transition-colors hover:underline">
                      服务条款
                    </Link>{" "}
                    和{" "}
                    <Link
                      href="/privacy"
                      className="text-primary transition-colors hover:underline"
                    >
                      隐私政策
                    </Link>
                  </Label>
                </motion.div>

                <motion.div
                  className="flex items-center space-x-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 1.1 }}
                >
                  <Checkbox id="newsletter" />
                  <Label htmlFor="newsletter" className="text-sm">
                    订阅我们的新闻通讯，获取最新更新
                  </Label>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 1.2 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    type="submit"
                    className="from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 w-full bg-gradient-to-r transition-all duration-200"
                  >
                    创建账户
                  </Button>
                </motion.div>
              </motion.form>

              <motion.div
                className="text-center text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 1.3 }}
              >
                已经有账户了？{" "}
                <Link href="/login" className="text-primary transition-colors hover:underline">
                  立即登录
                </Link>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}
