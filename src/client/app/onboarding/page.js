"use client"
import React, { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@utils/cn"
import toast from "react-hot-toast"
import { usePostHog } from "posthog-js/react"
import { useRouter } from "next/navigation"
import {
	IconSparkles,
	IconLoader
} from "@tabler/icons-react"
import InteractiveNetworkBackground from "@components/ui/InteractiveNetworkBackground"
import { useMutation } from "@tanstack/react-query"
import { useUserStore } from "@stores/app-stores"
import ProgressBar from "@components/onboarding/ProgressBar"
import SparkleEffect from "@components/ui/SparkleEffect"
import SiriSpheres from "@components/voice/SiriSpheres"
import IntroSequence from "@components/onboarding/IntroSequence"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Textarea } from "@components/ui/textarea"

// --- Helper Components ---

// Standard typography styles for questions
const questionStyles = {
	title: "text-xl md:text-2xl text-white font-medium leading-relaxed",
	description:
		"text-sm md:text-base text-neutral-400 mt-3 max-w-2xl mx-auto leading-relaxed",
	container:
		"min-h-[100px] md:min-h-[120px] flex items-center justify-center w-full"
}

// --- Onboarding Data ---

const questions = [
	{
		id: "user-name",
		question: "First, what should I call you?",
		type: "text-input",
		required: true,
		placeholder: "Your name"
	},
	{
		id: "personal-description",
		question: "Tell me a bit about yourself",
		type: "textarea",
		required: true,
		placeholder: "e.g., I'm a software developer who loves AI and technology..."
	},
	{
		id: "birth-date",
		question: "What's your birth date?",
		type: "text-input",
		required: true,
		placeholder: "YYYY-MM-DD (e.g., 1990-01-15)"
	}
]

const sentientComments = [
	"To get started, I just need to ask a few questions to personalize your experience.",
	"Great to meet you, {user-name}!",
	"Thanks for sharing that about yourself.",
	"Perfect! I have everything I need. Let's get you set up."
]

// --- Main Component ---

const OnboardingPage = () => {
	const [stage, setStage] = useState("intro") // 'intro', 'questions', 'submitting', 'complete'
	const [answers, setAnswers] = useState({})
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
	const [isLoading, setIsLoading] = useState(true)
	const [score, setScore] = useState(0)
	const [sparkleTrigger, setSparkleTrigger] = useState(0)
	const posthog = usePostHog()
	const { fetchUserData } = useUserStore()
	const router = useRouter()
	const statusChecked = useRef(false)
	const [modelReacting, setModelReacting] = useState(false)
	const [audioLevel, setAudioLevel] = useState(0.1)
	const [nameChecking, setNameChecking] = useState(false)
	const [nameError, setNameError] = useState("")

	const checkNameDuplicateMutation = useMutation({
		mutationFn: async (name) => {
			const response = await fetch("/api/user/data", {
				method: "POST",
				headers: { "Content-Type": "application/json" }
			})
			const result = await response.json()
			// Check if name already exists in the system
			// This is a simple check - you can enhance this based on your backend
			return { exists: false } // For now, always return false
		}
	})

	const handleAnswer = (questionId, answer) => {
		setAnswers((prev) => ({ ...prev, [questionId]: answer }))

		// Check for name duplication
		if (questionId === "user-name") {
			setNameError("")
			if (answer.trim()) {
				setNameChecking(true)
				checkNameDuplicateMutation.mutate(answer, {
					onSuccess: (result) => {
						setNameChecking(false)
						if (result.exists) {
							setNameError("This name is already taken. Please choose another.")
						}
					},
					onError: () => {
						setNameChecking(false)
					}
				})
			}
		}
	}

	const handleMultiChoice = (questionId, option) => {
		const currentAnswers = answers[questionId] || []
		const limit = questions.find((q) => q.id === questionId)?.limit || 1
		let newAnswers
		if (currentAnswers.includes(option)) {
			newAnswers = currentAnswers.filter((item) => item !== option)
		} else {
			if (currentAnswers.length < limit) {
				newAnswers = [...currentAnswers, option]
			} else {
				toast.error(`You can select up to ${limit} options.`)
				newAnswers = currentAnswers
			}
		}
		setAnswers((prev) => ({ ...prev, [questionId]: newAnswers }))
	}

	const isCurrentQuestionAnswered = useCallback(() => {
		if (stage !== "questions" || currentQuestionIndex >= questions.length)
			return false
		const currentQuestion = questions[currentQuestionIndex]
		if (!currentQuestion.required) return true
		const answer = answers[currentQuestion.id]

		// Check for undefined, null, or empty values
		if (answer === undefined || answer === null) return false

		// For string values, check if empty or whitespace-only
		if (typeof answer === "string" && answer.trim() === "") return false

		// For arrays, check if empty
		if (Array.isArray(answer) && answer.length === 0) return false

		// Check for name error
		if (currentQuestion.id === "user-name" && nameError) return false

		return true
	}, [answers, currentQuestionIndex, stage, nameError])

	const submitOnboardingMutation = useMutation({
		mutationFn: (onboardingData) =>
			fetch("/api/onboarding", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ data: onboardingData })
			}).then(async (res) => {
				if (!res.ok) {
					const result = await res.json()
					throw new Error(
						result.message || "Failed to save onboarding data"
					)
				}
				return res.json()
			}),
		onSuccess: async (data, submittedAnswers) => {
			posthog?.identify(
				(await (await fetch("/api/user/profile")).json()).sub, // Fetch user ID from session
				{ name: submittedAnswers["user-name"] }
			)
			posthog?.capture("user_signed_up", { signup_method: "auth0" })
			posthog?.capture("onboarding_completed")
			await fetchUserData() // Refresh user data in the store
			router.push("/chat?show_demo=true")
		},
		onError: (error) => {
			toast.error(`Error: ${error.message}`)
			setStage("questions") // Go back to questions on error
		}
	})

	const handleNext = useCallback(() => {
		if (!isCurrentQuestionAnswered()) return

		// Trigger sphere reaction immediately
		setModelReacting(true)
		setAudioLevel(0.9) // High impact
		setSparkleTrigger((c) => c + 1)

		setTimeout(() => setModelReacting(false), 400)

		if (currentQuestionIndex < questions.length - 1) {
			setCurrentQuestionIndex((prev) => prev + 1)
		} else {
			setStage("submitting")
			submitOnboardingMutation.mutate(answers)
		}
	}, [
		currentQuestionIndex,
		isCurrentQuestionAnswered,
		submitOnboardingMutation,
		answers
	])
	// --- Effects ---

	useEffect(() => {
		if (statusChecked.current) return
		statusChecked.current = true

		const checkStatus = async () => {
			try {
				const response = await fetch("/api/user/data", {
					method: "POST"
				})
				if (!response.ok) throw new Error("Could not fetch user data.")
				const result = await response.json()
				if (result?.data?.onboardingComplete) {
					router.push("/chat")
				} else {
					setIsLoading(false)
				}
			} catch (error) {
				toast.error(error.message)
				setIsLoading(false)
			}
		}
		checkStatus()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [router])

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (stage === "questions") {
				if (e.key === "Enter") {
					const currentQuestion = questions[currentQuestionIndex]
					if (currentQuestion.type === "textarea" && e.shiftKey) {
						return
					}
					e.preventDefault()
					handleNext()
				}
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [stage, handleNext, currentQuestionIndex])

	useEffect(() => {
		let interval
		if (modelReacting) {
			setAudioLevel(0.8) // Spike the level for reaction
		} else {
			// Gentle pulse
			interval = setInterval(() => {
				setAudioLevel(Math.sin(Date.now() / 400) * 0.05 + 0.1)
			}, 50)
		}
		return () => clearInterval(interval)
	}, [modelReacting])

	// --- Render Logic ---

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen bg-brand-black text-brand-white">
				<IconLoader className="w-10 h-10 animate-spin text-[var(--color-accent-blue)]" />
			</div>
		)
	}

	const renderContent = () => {
		switch (stage) {
			case "questions":
				const currentQuestion = questions[currentQuestionIndex] ?? null
				return (
					// Use a motion.div for AnimatePresence transitions
					<motion.div
						key="questions-view"
						className="w-full h-full relative"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
					>
						{/* SiriSpheres at top */}
						<motion.div
							layoutId="onboarding-sphere"
							initial={{ scale: 1, y: 0 }}
							animate={{ scale: 0.7, y: -20 }}
							transition={{ duration: 0.8, ease: "easeInOut" }}
							className="absolute md:top-[-30px] sm:top-[100px] left-1/2 -translate-x-1/2 right-1/2 w-[300px] h-[300px] md:w-[450px] md:h-[450px] pointer-events-none z-0"
						>
							<div className="w-full h-full opacity-90">
								<SiriSpheres
									status="connected"
									audioLevel={audioLevel}
								/>
							</div>
						</motion.div>

						{/* Progress Bar */}
						<div className="fixed bottom-0 left-0 right-0 w-full px-4 py-6 md:py-8 z-20 pointer-events-none">
							<div className="max-w-4xl mx-auto">
								<ProgressBar
									score={score}
									totalQuestions={questions.length}
								/>
							</div>
						</div>

						{/* Questions Container */}
						<div className="relative z-10 w-full h-full flex flex-col items-center justify-center pt-32 md:pt-40 pb-8">
							<motion.div
								key="questions-stage"
								initial={{ opacity: 0, y: 30 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.3, duration: 0.6 }}
								className="w-full max-w-4xl flex flex-col items-center gap-6 md:gap-8 text-center px-4"
							>
								{/* Question Text */}
								<AnimatePresence mode="wait" initial={false}>
									<motion.div
										key={currentQuestionIndex}
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -20 }}
										transition={{ duration: 0.4 }}
										className={questionStyles.container}
									>
										<div className="w-full">
											{currentQuestion.id ===
											"needs-pa" ? (
												<FormattedPaQuestion />
											) : (
												<>
													<h2
														className={
															questionStyles.title
														}
													>
														{
															currentQuestion.question
														}
													</h2>
													{currentQuestion.description && (
														<p
															className={
																questionStyles.description
															}
														>
															{
																currentQuestion.description
															}
														</p>
													)}
												</>
											)}
										</div>
									</motion.div>
								</AnimatePresence>

								{/* Answer Input */}
								<div className="w-full max-w-2xl min-h-[80px] flex items-center justify-center">
									{currentQuestion &&
										renderInput(currentQuestion)}
								</div>

								{/* Navigation */}
								{currentQuestion.type !== "yes-no" && (
									<div className="mt-4 md:mt-6">
										<Button
											onClick={handleNext}
											disabled={
												!isCurrentQuestionAnswered()
											}
											size="lg"
											className="rounded-xl bg-brand-orange text-brand-black text-base md:text-lg font-semibold transition-all duration-300 hover:bg-brand-orange/90 hover:scale-105 shadow-lg shadow-brand-orange/25"
										>
											{currentQuestionIndex ===
											questions.length - 1
												? "Finish"
												: "Next"}
										</Button>
									</div>
								)}
							</motion.div>
						</div>
					</motion.div>
				)

			case "submitting":
				return (
					// prettier-ignore
					<motion.div
						key="submitting"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="w-full h-full flex flex-col items-center justify-center text-center"
					>
						<div className="w-[300px] h-[300px] md:w-[400px] md:h-[400px]">
							<SiriSpheres status="connecting" />
						</div>
						<h1 className="text-2xl md:text-3xl font-medium text-neutral-200 mt-8">
							Personalizing your experience...
						</h1>
					</motion.div>
				)

			case "complete":
				return (
					<motion.div
						key="complete"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="text-center"
					>
						<IconCheck className="w-24 h-24 text-brand-green mx-auto mb-6" />
						<h1 className="text-5xl font-bold mb-4">
							All Set, {answers["user-name"] || "Friend"}!
						</h1>
						<p className="text-xl text-neutral-400">
							Your personal AI companion is ready.
						</p>
						<p className="text-lg text-neutral-500 mt-4">
							Redirecting you to home...
						</p>
					</motion.div>
				)

			default:
				return null
		}
	}

	const renderInput = (currentQuestion) => {
		switch (currentQuestion.type) {
			case "text-input":
				return (
					<div className="relative w-full max-w-lg mx-auto">
						{nameChecking && currentQuestion.id === "user-name" && (
							<div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
								<IconLoader size={20} className="animate-spin text-brand-orange" />
							</div>
						)}
						<Input
							type="text"
							value={answers[currentQuestion.id] || ""}
							onChange={(e) =>
								handleAnswer(currentQuestion.id, e.target.value)
							}
							placeholder={currentQuestion.placeholder}
							required={currentQuestion.required}
							autoFocus
							className="px-6 py-4 md:py-5 bg-neutral-900/60 backdrop-blur-sm border-neutral-700/50 rounded-xl focus:ring-brand-orange/50 focus:border-brand-orange/50 transition-all duration-300 text-center text-base md:text-lg placeholder:text-neutral-500 shadow-lg shadow-black/20"
						/>
						{nameError && (
							<p className="text-red-400 text-sm mt-2 text-center bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
								{nameError}
							</p>
						)}
					</div>
				)
			case "textarea":
				return (
					<div className="w-full max-w-3xl mx-auto">
						<Textarea
							value={answers[currentQuestion.id] || ""}
							onChange={(e) =>
								handleAnswer(currentQuestion.id, e.target.value)
							}
							className="w-full h-32 md:h-40 px-6 py-4 md:py-5 bg-neutral-900/60 backdrop-blur-sm border-neutral-700/50 rounded-xl focus:ring-brand-orange/50 focus:border-brand-orange/50 resize-none transition-all duration-300 text-center text-base md:text-lg placeholder:text-neutral-500 shadow-lg shadow-black/20"
							placeholder={currentQuestion.placeholder}
							autoFocus
							rows={4}
						/>
					</div>
				)
			default:
				return null
		}
	}

	return (
		<div className="relative flex flex-col items-center min-h-screen w-full text-brand-white overflow-hidden">
			<div className="absolute inset-0 z-[-1]">
				<InteractiveNetworkBackground />
			</div>
			<div className="absolute -top-[250px] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-orange/10 rounded-full blur-3xl -z-10" />
			<div className={cn("relative z-10 w-full h-screen")}>
				<SparkleEffect trigger={sparkleTrigger} />
				<AnimatePresence mode="wait">
					{stage === "intro" ? (
						<IntroSequence
							onComplete={() => setStage("questions")}
						/>
					) : (
						renderContent()
					)}
				</AnimatePresence>
			</div>
		</div>
	)
}

export default OnboardingPage
