"use client"

import { motion } from "framer-motion"

const AnimatedLogo = () => {
	return (
		<motion.div
			className="relative flex items-center justify-center"
			initial={{ opacity: 0, scale: 0.8 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ duration: 0.5 }}
		>
			<motion.div
				className="relative w-10 h-10 rounded-full"
				style={{
					background: `radial-gradient(circle at 30% 30%, rgba(74, 158, 255, 0.9), rgba(157, 78, 221, 0.7), rgba(74, 158, 255, 0.5))`,
					boxShadow: "0 0 20px rgba(74, 158, 255, 0.4), 0 0 40px rgba(157, 78, 221, 0.3)",
					willChange: "transform, opacity"
				}}
				animate={{
					scale: [1, 1.05, 1],
					opacity: [0.8, 1, 0.8]
				}}
				transition={{
					duration: 4,
					repeat: Infinity,
					repeatType: "reverse",
					ease: "easeInOut"
				}}
			>
				{/* 中心高光 */}
				<div
					className="absolute inset-0 rounded-full"
					style={{
						background: `radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3), transparent 60%)`
					}}
				/>
			</motion.div>
		</motion.div>
	)
}

export default AnimatedLogo

