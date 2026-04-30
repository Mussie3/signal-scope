const ToggleButton = () => {
    return (
        <label htmlFor="toggle" className="group inline-block cursor-pointer">
            <input type="checkbox" id="toggle" className="sr-only" />
            <div className="h-8 w-16 rounded-full bg-gray-300 group-has-[:checked]:bg-blue-500 relative transition-colors">
                <div className="absolute left-1 top-1 h-6 w-6 rounded-full bg-white transition-transform group-has-[:checked]:translate-x-8" />
            </div>
        </label>
    )
}

export default ToggleButton
