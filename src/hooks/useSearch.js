// useSearch.js - 搜索功能 Hook

import { useState, useCallback, useEffect } from 'react'
import { searchConversations, addSearchHistory, getSearchHistory } from '../utils/storage'

export function useSearch(conversations) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searchHistory, setSearchHistory] = useState([])
  const [isSearching, setIsSearching] = useState(false)

  // 加载搜索历史
  useEffect(() => {
    setSearchHistory(getSearchHistory())
  }, [])

  // 搜索函数（带防抖）
  const performSearch = useCallback((searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    // 使用 setTimeout 实现防抖
    setTimeout(() => {
      const searchResults = searchConversations(searchQuery)
      setResults(searchResults)
      setIsSearching(false)
    }, 300)
  }, [])

  // 当 query 变化时执行搜索
  useEffect(() => {
    performSearch(query)
  }, [query, performSearch])

  // 执行搜索并保存历史
  const search = useCallback((searchQuery) => {
    setQuery(searchQuery)
    if (searchQuery.trim()) {
      addSearchHistory(searchQuery)
      setSearchHistory(getSearchHistory())
    }
  }, [])

  // 清空搜索
  const clearSearch = useCallback(() => {
    setQuery('')
    setResults([])
    setIsSearching(false)
  }, [])

  // 从历史中选择搜索
  const searchFromHistory = useCallback((historyQuery) => {
    search(historyQuery)
  }, [search])

  // 高亮匹配文本
  const highlightMatch = useCallback((text, matchQuery) => {
    if (!matchQuery.trim()) return text

    const lowerText = text.toLowerCase()
    const lowerQuery = matchQuery.toLowerCase()
    const index = lowerText.indexOf(lowerQuery)

    if (index === -1) return text

    const before = text.slice(0, index)
    const match = text.slice(index, index + matchQuery.length)
    const after = text.slice(index + matchQuery.length)

    return `${before}<mark>${match}</mark>${after}`
  }, [])

  return {
    query,
    setQuery,
    results,
    searchHistory,
    isSearching,
    search,
    clearSearch,
    searchFromHistory,
    highlightMatch,
    hasResults: results.length > 0,
    isEmpty: query.trim() === ''
  }
}