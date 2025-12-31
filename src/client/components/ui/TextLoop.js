"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

const TextLoop = ({ children, className = "", interval = 3000 }) => {
	const [currentIndex, setCurrentIndex] = useState(0)
	const items = Array.isArray(children) ? children : [children]

	useEffect(() => {
		if (items.length <= 1) return

		const timer = setInterval(() => {
			setCurrentIndex((prev) => (prev + 1) % items.length)
		}, interval)

		return () => clearInterval(timer)
	}, [items.length, interval])

	if (items.length === 0) return null
	if (items.length === 1) return <span className={className}>{items[0]}</span>

	return (
		<span className={className}>
			<AnimatePresence mode="wait">
				<motion.span
					key={currentIndex}
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -10 }}
					transition={{ duration: 0.3 }}
				>
					{items[currentIndex]}
				</motion.span>
			</AnimatePresence>
		</span>
	)
}

export default TextLoop

