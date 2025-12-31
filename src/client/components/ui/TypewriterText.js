"use client"

import { useState, useEffect } from "react"

const TypewriterText = ({ text = "", speed = 30, onComplete }) => {
	const [displayedText, setDisplayedText] = useState("")
	const [showCursor, setShowCursor] = useState(true)

	useEffect(() => {
		if (!text) {
			setDisplayedText("")
			return
		}

		setDisplayedText("")
		let currentIndex = 0

		// 动态速度：长段落稍快，短句稍慢
		const baseSpeed = speed
		const dynamicSpeed = text.length > 100 ? baseSpeed * 0.7 : baseSpeed

		const typeInterval = setInterval(() => {
			if (currentIndex < text.length) {
				setDisplayedText(text.slice(0, currentIndex + 1))
				currentIndex++
			} else {
				clearInterval(typeInterval)
				setShowCursor(false)
				if (onComplete) {
					setTimeout(onComplete, 100)
				}
			}
		}, dynamicSpeed)

		return () => {
			clearInterval(typeInterval)
		}
	}, [text, speed, onComplete])

	// 光标闪烁动画
	useEffect(() => {
		if (!showCursor) return
		const cursorInterval = setInterval(() => {
			setShowCursor((prev) => !prev)
		}, 530)
		return () => clearInterval(cursorInterval)
	}, [showCursor])

	return (
		<span className="inline whitespace-pre-wrap">
			{displayedText}
			{showCursor && (
				<span className="inline-block w-0.5 h-5 ml-1 bg-soul-blue animate-pulse" />
			)}
		</span>
	)
}

export default TypewriterText

