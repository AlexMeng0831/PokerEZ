"use client";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { buttonVariants, type ButtonProps } from "./button";
import { cn } from "@/lib/utils";
type Props = HTMLMotionProps<"button"> &
  Pick<ButtonProps, "variant" | "size"> & { reduceMotion?: boolean };
export function AnimatedButton({
  variant,
  size,
  className,
  reduceMotion = false,
  disabled,
  ...props
}: Props) {
  const systemReduced = useReducedMotion();
  const reduced = systemReduced || reduceMotion;
  return (
    <motion.button
      {...props}
      disabled={disabled}
      className={cn(
        buttonVariants({ variant, size }),
        "animated-button",
        className,
      )}
      whileHover={!disabled && !reduced ? { y: -2, scale: 1.01 } : undefined}
      whileTap={!disabled && !reduced ? { y: 0, scale: 0.97 } : undefined}
      transition={{ type: "spring", stiffness: 440, damping: 28 }}
    />
  );
}
