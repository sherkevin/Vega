import "../styles/globals.css"

export const metadata = {
	title: "Simple Chat Bot",
	description: "A simple AI chat assistant",
}

export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<body className="antialiased" suppressHydrationWarning>{children}</body>
		</html>
	)
}

