import { motion } from "motion/react";

export const BreathingLine = () => {
  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-0">
      {/* Horizontal Breathing Line */}
      <motion.div
        className="h-[1px] bg-[#C0C6CF]"
        initial={{ width: "0%", opacity: 0 }}
        animate={{ 
          width: ["0%", "40%", "0%"],
          opacity: [0, 0.2, 0]
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Subtle Grain Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      
      {/* Vertical Rail Text - Aesthetic Touch */}
      <div className="absolute left-8 top-1/2 -translate-y-1/2 hidden md:block">
        <p className="[writing-mode:vertical-rl] rotate-180 text-[10px] tracking-[0.5em] text-[#999999] uppercase font-light opacity-30">
          SILENCE IS ETERNAL • 寂静永恒
        </p>
      </div>
    </div>
  );
};
