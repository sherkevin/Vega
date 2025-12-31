"use client"

import { forwardRef } from "react"
import { cn } from "@utils/cn"

const Button = forwardRef(
	({ className, variant = "default", size = "default", ...props }, ref) => {
		const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"

		const variants = {
			default: "bg-brand-orange text-brand-black hover:bg-brand-orange/90",
			ghost: "hover:bg-white/10 hover:text-white",
			destructive: "bg-red-500 text-white hover:bg-red-600",
		}

		const sizes = {
			default: "h-10 px-4 py-2",
			icon: "h-9 w-9",
			sm: "h-8 px-3 text-sm",
			lg: "h-11 px-8",
		}

		return (
			<button
				ref={ref}
				className={cn(
					baseStyles,
					variants[variant] || variants.default,
					sizes[size] || sizes.default,
					className
				)}
				{...props}
			/>
		)
	}
)

Button.displayName = "Button"

export { Button }

