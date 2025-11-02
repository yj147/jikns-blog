"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { BookOpen, Users, Sparkles } from "lucide-react"
import { motion } from "framer-motion"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 py-20">
      <div className="absolute inset-0 -z-10">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 20,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
          className="bg-primary/5 absolute left-1/4 top-1/4 h-64 w-64 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [360, 180, 0],
          }}
          transition={{
            duration: 25,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
          className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl"
        />
      </div>

      <div className="container mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <motion.h1
            className="mb-6 text-4xl font-bold tracking-tight md:text-6xl"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            现代化博客与
            <motion.span
              className="text-primary inline-block"
              animate={{
                textShadow: ["0 0 0px #10b981", "0 0 20px #10b981", "0 0 0px #10b981"],
              }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            >
              {" "}
              社交平台
            </motion.span>
          </motion.h1>
        </motion.div>

        <motion.p
          className="text-muted-foreground mx-auto mb-8 max-w-2xl text-xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          探索精彩内容，分享生活动态，与志同道合的朋友建立连接
        </motion.p>

        <motion.div
          className="flex flex-col justify-center gap-4 sm:flex-row"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <motion.div
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Button size="lg" asChild className="group relative overflow-hidden">
              <Link href="/blog">
                <motion.div
                  className="from-primary/20 absolute inset-0 bg-gradient-to-r to-emerald-500/20"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.5 }}
                />
                <BookOpen className="relative z-10 mr-2 h-4 w-4" />
                <span className="relative z-10">浏览博客</span>
              </Link>
            </Button>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Button
              size="lg"
              variant="outline"
              asChild
              className="group relative overflow-hidden bg-transparent"
            >
              <Link href="/feed">
                <motion.div
                  className="from-primary/10 absolute inset-0 bg-gradient-to-r to-emerald-500/10"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.5 }}
                />
                <Users className="relative z-10 mr-2 h-4 w-4" />
                <span className="relative z-10">查看动态</span>
              </Link>
            </Button>
          </motion.div>
        </motion.div>

        <motion.div
          className="text-primary/20 absolute left-20 top-20"
          animate={{
            y: [0, -20, 0],
            rotate: [0, 10, 0],
          }}
          transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
        >
          <Sparkles className="h-8 w-8" />
        </motion.div>

        <motion.div
          className="absolute right-20 top-32 text-emerald-500/20"
          animate={{
            y: [0, 20, 0],
            rotate: [0, -10, 0],
          }}
          transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, delay: 1 }}
        >
          <BookOpen className="h-6 w-6" />
        </motion.div>
      </div>
    </section>
  )
}
