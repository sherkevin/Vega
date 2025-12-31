"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"

const AmbientBackground = () => {
	const [isMobile, setIsMobile] = useState(false)

	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 768)
		}
		checkMobile()
		window.addEventListener("resize", checkMobile)
		return () => window.removeEventListener("resize", checkMobile)
	}, [])

	// 移动端禁用或简化
	if (isMobile) {
		return null
	}

	// 定义光斑配置
	const orbs = [
		{
			color: "#4A9EFF", // Soul Blue
			size: "60vw",
			initialX: "10%",
			initialY: "20%",
			animateX: ["10%", "30%", "10%"],
			animateY: ["20%", "40%", "20%"],
			duration: 25
		},
		{
			color: "#FFD166", // Warm Amber
			size: "50vw",
			initialX: "70%",
			initialY: "60%",
			animateX: ["70%", "50%", "70%"],
			animateY: ["60%", "80%", "60%"],
			duration: 30
		},
		{
			color: "#9D4EDD", // Mystery Purple
			size: "55vw",
			initialX: "50%",
			initialY: "10%",
			animateX: ["50%", "60%", "50%"],
			animateY: ["10%", "30%", "10%"],
			duration: 28
		}
	]

	return (
		<div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
			{orbs.map((orb, index) => (
				<motion.div
					key={index}
					className="absolute rounded-full opacity-20"
					style={{
						width: orb.size,
						height: orb.size,
						background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
						filter: "blur(100px)",
						left: orb.initialX,
						top: orb.initialY,
						transform: "translate(-50%, -50%)",
						willChange: "transform",
						backfaceVisibility: "hidden"
					}}
					animate={{
						x: orb.animateX,
						y: orb.animateY
					}}
					transition={{
						duration: orb.duration,
						repeat: Infinity,
						repeatType: "reverse",
						ease: "easeInOut"
					}}
				/>
			))}
			{/* 噪点纹理层（可选） */}
			<div
				className="absolute inset-0 opacity-[0.05]"
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
					backgroundSize: "200px 200px"
				}}
			/>
		</div>
	)
}

export default AmbientBackground

