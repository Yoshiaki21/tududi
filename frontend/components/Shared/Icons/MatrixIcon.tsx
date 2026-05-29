import React from 'react';

interface MatrixIconProps {
    className?: string;
    title?: string;
}

const MatrixIcon: React.FC<MatrixIconProps> = ({
    className = 'h-5 w-5',
    title,
}) => {
    return (
        <svg
            className={className}
            viewBox="0 0 32 32"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            {...(title && { title })}
        >
            <path d="M2 2v28h3V4h1.5V30h3V4H11V2H2zM21 2v2h1.5v24H21v2h9V2h-9zm1.5 2h4.5v24h-4.5V4z" />
            <path d="M10.5 10v3.5L13 16l-2.5 2.5V22h2v-2.8l2.5-2.5V14l-2.5-2.5V10h-2zM19.5 10v3.5L17 16l2.5 2.5V22h2v-3.5L19 16l2.5-2.5V10h-2z" />
        </svg>
    );
};

export default MatrixIcon;
