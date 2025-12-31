"use client"

import { useRef, useEffect } from "react"

const ParticleOrb = ({ size = 200 }) => {
	const canvasRef = useRef(null)
	const animationFrameRef = useRef(null)
	const particlesRef = useRef([])
	const timeRef = useRef(0)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const ctx = canvas.getContext("2d")
		const dpr = window.devicePixelRatio || 1
		const rect = canvas.getBoundingClientRect()
		
		canvas.width = rect.width * dpr
		canvas.height = rect.height * dpr
		ctx.scale(dpr, dpr)
		
		const width = rect.width
		const height = rect.height
		const centerX = width / 2
		const centerY = height / 2
		const baseRadius = Math.min(width, height) * 0.3

		// Initialize particles (~200 particles)
		const particleCount = 200
		if (particlesRef.current.length === 0) {
			particlesRef.current = Array.from({ length: particleCount }, (_, i) => ({
				baseAngle: (Math.PI * 2 * i) / particleCount,
				offset: Math.random() * Math.PI * 2,
				size: 1.5 + Math.random() * 1,
				x: centerX,
				y: centerY,
				baseRadius: baseRadius + (Math.random() - 0.5) * 20,
			}))
		}

		const render = () => {
			// Clear canvas - use full clear for crisp particles
			ctx.clearRect(0, 0, width, height)
			
			// Update time
			timeRef.current += 0.05

			particlesRef.current.forEach((p) => {
				// Always use gentle breathing - stable idle state
				const currentAngle = p.baseAngle
				const vibration = Math.sin(timeRef.current * 0.5 + p.offset) * 3
				
				// Subtle warm glow (Amber/Gold)
				const glowColor = "rgba(255, 209, 102, 0.2)"
				const color = "rgba(255, 255, 255, 0.85)"

				const r = p.baseRadius + vibration
				p.x = centerX + Math.cos(currentAngle) * r
				p.y = centerY + Math.sin(currentAngle) * r

				// Draw particle with glow
				ctx.beginPath()
				ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2)
				ctx.fillStyle = glowColor
				ctx.fill()

				ctx.beginPath()
				ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
				ctx.fillStyle = color
				ctx.fill()
			})

			animationFrameRef.current = requestAnimationFrame(render)
		}

		render()

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current)
			}
		}
	}, [size])

	return (
		<div 
			className="relative flex items-center justify-center"
			style={{ width: size, height: size }}
		>
			{/* Dark radial gradient background for contrast */}
			<div 
				className="absolute inset-0 rounded-full"
				style={{
					background: "radial-gradient(circle, rgba(0, 0, 0, 0.6), transparent 70%)",
					pointerEvents: "none"
				}}
			/>
			<canvas
				ref={canvasRef}
				className="relative z-10"
				style={{ width: "100%", height: "100%" }}
			/>
		</div>
	)
}

export default ParticleOrb

