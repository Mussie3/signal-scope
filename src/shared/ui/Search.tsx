import SearchIcon from "@/assets/search-icon.svg"

const Search = () => {
    return (
        <div className="w-98 h-10 px-2 flex items-center gap-2 rounded-lg bg-white/20">
            <img src={SearchIcon} alt="search" className="w-6 h-6" />
            <input className="bg-transparent outline-none w-84 text-white" />
        </div>
    )
}

export default Search