import { Fragment } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ children, show = false, maxWidth = '2xl', closeable = true, onClose = () => { } }) {
    const close = () => {
        if (closeable) {
            onClose();
        }
    };

    if (!show) {
        return null;
    }

    const maxWidthClass = {
        sm: 'sm:max-w-sm',
        md: 'sm:max-w-md',
        lg: 'sm:max-w-lg',
        xl: 'sm:max-w-xl',
        '2xl': 'sm:max-w-2xl',
        '3xl': 'sm:max-w-3xl',
    }[maxWidth];

    return createPortal(
        <div className="fixed inset-0 z-[3000] overflow-y-auto px-4 py-6 sm:px-0 flex items-center justify-center">
            <div className="absolute inset-0 transition-opacity" onClick={close}>
                <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
            </div>

            <div className={`mb-6 bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-xl transform transition-all w-full sm:mx-auto relative z-50 ${maxWidthClass}`}>
                {children}
            </div>
        </div>,
        document.body
    );
}
