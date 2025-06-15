"use client";

import { Icon } from "@iconify-icon/react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function InnerThemeToggle({ className }: { className?: string }) {
	const { theme, setTheme } = useTheme();

	const tooltipText = `Switch to ${theme === "light" ? "Dark" : "Light"} Mode`;

	const toggleTheme = () => {
		setTheme(theme === "light" ? "dark" : "light");
	};

	return (
		<Button
			type="button"
			className={cn("text-lg", className)}
			variant="ghost"
			onClick={toggleTheme}
		>
			<Icon
				noobserver
				icon={
					theme === "light"
						? "line-md:moon-to-sunny-outline-loop-transition"
						: "line-md:sunny-outline-to-moon-loop-transition"
				}
			/>
			<span className="text-sm font-normal">{tooltipText}</span>
		</Button>
	);
}

const ThemeToggle = dynamic(() => Promise.resolve(InnerThemeToggle), {
	loading: () => <Skeleton className="w-full justify-start" />,
	ssr: false,
});

export { ThemeToggle };
