import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from './Input';

export type PasswordInputProps = Omit<InputProps, 'type' | 'rightAddon'>;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        rightAddon={
          <button
            type="button"
            onClick={() => setVisible((prev) => !prev)}
            aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            title={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#10264D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10264D] cursor-pointer"
          >
            {visible ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        }
        {...props}
      />
    );
  },
);
