import localFont from "next/font/local"
import { Manrope } from "next/font/google"

export const geistSans = localFont({
  src: [
    {
      path: "../public/fonts/geist/Geist-Variable.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-geist-sans",
  display: "swap",
})

export const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
})

import { Lora } from "next/font/google"

export const lora = Lora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-lora",
})
