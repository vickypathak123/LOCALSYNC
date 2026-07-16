import { colorForName, initialsForName } from '@/lib/avatar';

const SIZE_CLASSES = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

interface AvatarProps {
  name: string;
  size?: keyof typeof SIZE_CLASSES;
  ringed?: boolean;
}

export default function Avatar({ name, size = 'md', ringed = false }: AvatarProps) {
  const color = colorForName(name || '?');
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${SIZE_CLASSES[size]} ${
        ringed ? 'ring-2 ring-white dark:ring-slate-900' : ''
      }`}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {initialsForName(name)}
    </div>
  );
}
