"use client"

import { useRef, useEffect } from "react"

const CymaticsBackground = ({ isActive = false }) => {
	const canvasRef = useRef(null)
	const animationFrameRef = useRef(null)
	const particlesRef = useRef([])
	const timeRef = useRef(0)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const ctx = canvas.getContext("2d")
		const dpr = window.devicePixelRatio || 1
		
		let width = window.innerWidth
		let height = window.innerHeight
		let centerX = width / 2
		let centerY = height / 2
		const baseRadius = 100 // Further reduced radius for smaller circle
		
		const resizeCanvas = () => {
			const newWidth = window.innerWidth
			const newHeight = window.innerHeight
			
			width = newWidth
			height = newHeight
			centerX = width / 2
			centerY = height / 2
			
			canvas.width = width * dpr
			canvas.height = height * dpr
			ctx.scale(dpr, dpr)
			canvas.style.width = `${width}px`
			canvas.style.height = `${height}px`
			
			// Update core particles center position
			particlesRef.current.forEach((p) => {
				if (p.type === "ambient") {
					// Wrap ambient particles to new screen bounds
					if (p.x > width) p.x = width
					if (p.y > height) p.y = height
				}
			})
		}

		resizeCanvas()
		window.addEventListener("resize", resizeCanvas)

		// Initialize particles
		if (particlesRef.current.length === 0) {
			// Layer A: Ambient Dust (increased to 200 particles)
			const ambientCount = 200
			const ambientParticles = Array.from({ length: ambientCount }, () => ({
				type: "ambient",
				x: Math.random() * width,
				y: Math.random() * height,
				vx: (Math.random() - 0.5) * 0.5,
				vy: (Math.random() - 0.5) * 0.5,
			}))

			// Layer B: Central Core particles (same density as ambient, ~200 particles)
			// All particles roam freely at all times
			const coreCount = 200
			const coreParticles = Array.from({ length: coreCount }, () => {
				// Start with random position and velocity (like ambient particles)
				return {
					type: "core",
					baseRadius: baseRadius,
					x: Math.random() * width,
					y: Math.random() * height,
					vx: (Math.random() - 0.5) * 0.5,
					vy: (Math.random() - 0.5) * 0.5,
				}
			})

			particlesRef.current = [...ambientParticles, ...coreParticles]
		}

		const render = () => {
			// Clear canvas with almost pure black background
			ctx.fillStyle = "#050505"
			ctx.fillRect(0, 0, width, height)

			// Update time
			timeRef.current += 0.05

			// Ensure particles are initialized
			if (particlesRef.current.length === 0) {
				// Re-initialize if particles are missing
				const ambientCount = 200
				const ambientParticles = Array.from({ length: ambientCount }, () => ({
					type: "ambient",
					x: Math.random() * width,
					y: Math.random() * height,
					vx: (Math.random() - 0.5) * 0.5,
					vy: (Math.random() - 0.5) * 0.5,
				}))

				const coreCount = 200
				const coreParticles = Array.from({ length: coreCount }, () => {
					return {
						type: "core",
						baseRadius: baseRadius,
						x: Math.random() * width,
						y: Math.random() * height,
						vx: (Math.random() - 0.5) * 0.5,
						vy: (Math.random() - 0.5) * 0.5,
					}
				})

				particlesRef.current = [...ambientParticles, ...coreParticles]
			}

			particlesRef.current.forEach((p) => {
				if (p.type === "ambient") {
					// Ambient dust: slow drift
					p.x += p.vx
					p.y += p.vy

					// Wrap around screen edges
					if (p.x < 0) p.x = width
					if (p.x > width) p.x = 0
					if (p.y < 0) p.y = height
					if (p.y > height) p.y = 0

					// Draw ambient particle - larger white dot
					ctx.beginPath()
					ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
					ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
					ctx.fill()
				} else if (p.type === "core") {
					// Central core particles: always free-roaming like ambient particles
					if (isActive) {
						// When active: continue roaming but add subtle radial vibration effect
						// Calculate distance and angle from center
						const dx = p.x - centerX
						const dy = p.y - centerY
						const distance = Math.sqrt(dx * dx + dy * dy)
						const angle = Math.atan2(dy, dx)
						
						// Add subtle radial vibration when particles are near the circle radius
						if (Math.abs(distance - p.baseRadius) < 60) {
							const vibration = Math.sin(angle * 20 + timeRef.current * 1.5) * 10
							const pulse = Math.sin(timeRef.current * 1) * 6
							const radialOffset = (vibration + pulse) * 0.15
							
							// Apply subtle radial offset while maintaining free movement
							p.x += Math.cos(angle) * radialOffset
							p.y += Math.sin(angle) * radialOffset
						}
					}
					
					// Always continue free roaming (same as ambient particles)
					p.x += p.vx
					p.y += p.vy
					
					// Add some random variation to movement
					p.vx += (Math.random() - 0.5) * 0.05
					p.vy += (Math.random() - 0.5) * 0.05
					
					// Limit velocity
					const maxVel = 1
					p.vx = Math.max(-maxVel, Math.min(maxVel, p.vx))
					p.vy = Math.max(-maxVel, Math.min(maxVel, p.vy))
					
					// Wrap around screen edges
					if (p.x < 0) p.x = width
					if (p.x > width) p.x = 0
					if (p.y < 0) p.y = height
					if (p.y > height) p.y = 0

					// Draw core particle - larger white dot
					ctx.beginPath()
					ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
					ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
					ctx.fill()
				}
			})

			animationFrameRef.current = requestAnimationFrame(render)
		}

		// Start rendering immediately
		render()

		return () => {
			window.removeEventListener("resize", resizeCanvas)
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current)
			}
		}
	}, [isActive])

	return (
		<canvas
			ref={canvasRef}
			className="fixed inset-0 pointer-events-none"
			style={{ 
				background: "#050505",
				position: "fixed",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				zIndex: -1
			}}
		/>
	)
}

export default CymaticsBackground

