import { useState } from 'react'
import { supabase } from '../supabase'

export default function Auth() {
    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [otpSent, setOtpSent] = useState(false)

    const handleSendOtp = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMessage('')
    
        const { error } = await supabase.auth.signInWithOtp({
            email: email,
            options: {
                shouldCreateUser: true,
            }        
        })
    
        if (error) {
            setMessage(error.message)
        } else {
            console.log('Setting otpSent to true') // Add this
            setOtpSent(true)
            console.log('otpSent should now be true') // Add this
            setMessage('Check your email for the 6-digit code! Note: emails must be associated with a Qualified Nonprofit to view COPA listings.')
        }
        setLoading(false)
    }

    const handleVerifyOtp = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMessage('')

        const { error } = await supabase.auth.verifyOtp({
            email: email,
            token: otp,
            type: 'email'
        })

        if (error) {
            setMessage(error.message)
        } else {
            setMessage('Successfully logged in!')
            // Supabase will automatically handle the session
            // Your app should redirect via your auth state listener
        }
        setLoading(false)
    }

    const handleBackToEmail = () => {
        setOtpSent(false)
        setOtp('')
        setMessage('')
    }

    return (
        <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4">Login</h2>
            
            {!otpSent ? (
                <form onSubmit={handleSendOtp}>
                    <input
                        type="email"
                        placeholder="Your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-2 border rounded mb-4"
                        required
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                        {loading ? 'Sending...' : 'Send code'}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleVerifyOtp}>
                    <p className="mb-2 text-sm text-gray-600">Code sent to: {email}</p>
                    <input
                        type="text"
                        placeholder="Enter 6-digit code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full p-2 border rounded mb-4 text-center text-2xl tracking-widest"
                        maxLength="6"
                        pattern="[0-9]{6}"
                        required
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50 mb-2"
                    >
                        {loading ? 'Verifying...' : 'Verify code'}
                    </button>
                    <button
                        type="button"
                        onClick={handleBackToEmail}
                        className="w-full bg-gray-200 text-gray-700 p-2 rounded hover:bg-gray-300"
                    >
                        Use different email
                    </button>
                </form>
            )}
            
            {message && (
                <p className={`mt-4 text-center text-sm ${message.includes('error') || message.includes('Invalid') ? 'text-red-600' : 'text-green-600'}`}>
                    {message}
                </p>
            )}
        </div>
    )
}