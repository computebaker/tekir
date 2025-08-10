import Image from "next/image";
import { motion } from "framer-motion";

export type ModelLogoItemProps = {
  src: string;
  alt: string;
  label: string;
  delay?: number;
};

export function ModelLogoItem({ src, alt, label, delay = 0 }: ModelLogoItemProps) {
  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, delay }}
      className="flex flex-col items-center"
    >
      <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center p-3" style={{backgroundColor: '#0f0f0f'}}>
        <Image src={src} alt={alt} fill className="object-contain p-1" />
      </div>
      <p className="mt-2 text-sm font-medium">{label}</p>
    </motion.div>
  );
}

export default ModelLogoItem;
