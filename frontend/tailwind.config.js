/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: '#C75B2A',
  				foreground: '#FFFFFF',
  				hover: '#B04A1E',
  				light: '#F2DCD3'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			maya: {
  				primary: '#C75B2A',
  				'primary-hover': '#B04A1E',
  				'primary-light': '#F2DCD3',
  				cream: '#F5EBE0',
  				'cream-dark': '#EBE0D6',
  				text: '#2D2A26',
  				'text-muted': '#6B665F',
  				border: '#E6D5C3',
  				success: '#4A7C59',
  				warning: '#D9A44A',
  				error: '#D94A4A',
  				info: '#4A6FA5'
  			}
  		},
  		fontFamily: {
  			heading: ['Outfit', 'sans-serif'],
  			body: ['Plus Jakarta Sans', 'sans-serif'],
  			mono: ['JetBrains Mono', 'monospace']
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		boxShadow: {
  			soft: '0 4px 20px -2px rgba(45, 42, 38, 0.05)',
  			float: '0 10px 40px -10px rgba(199, 91, 42, 0.15)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
