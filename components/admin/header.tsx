'use client'

import * as React from 'react'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserData } from '@/types/user'
import { Search, User, Moon, Sun, Settings, LogOut, Shield, Smartphone, Wrench, Store } from 'lucide-react'
import { useTheme } from 'next-themes'
import { NotificationsDropdown } from './notifications-dropdown'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Spinner } from '@/components/ui/spinner'
import { DeviceDetailsModal } from './device-details-modal'
import { UserDetailsModal } from './user-details-modal'

interface Notification {
  id: string
  title: string
  description: string
  type: 'info' | 'warning' | 'error'
  created_at: string
  read: boolean
}

interface SearchResult {
  id?: string;
  type: string;
  title: string;
  description: string;
  url: string;
}

// Debounce hook
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

interface AdminHeaderProps {
  isCollapsed?: boolean;
  setIsCollapsed?: React.Dispatch<React.SetStateAction<boolean>>;
}

export function AdminHeader({ isCollapsed, setIsCollapsed }: AdminHeaderProps = {}) {
  const [user, setUser] = useState<UserData | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const supabase = createClient()

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        
        if (!error && data) {
          setUser(data as UserData)
        }
      }
    }

    const fetchNotifications = async () => {
      // Fetch notifications logic here
      const newNotifications: Notification[] = []
      setNotifications(newNotifications)
    }

    fetchUserData()
    fetchNotifications()
  }, [supabase])

  useEffect(() => {
    if (debouncedSearchQuery.length > 2) {
      setIsSearchLoading(true);
      fetch(`/api/admin/search?query=${debouncedSearchQuery}`)
        .then(res => res.json())
        .then(data => {
          setSearchResults(data);
          setIsSearchLoading(false);
          setIsSearchOpen(true);
        })
        .catch(err => {
          console.error(err);
          setIsSearchLoading(false);
        });
    } else {
      setSearchResults([]);
      setIsSearchOpen(false);
    }
  }, [debouncedSearchQuery]);

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSearchResultClick = (result: SearchResult) => {
    setSearchQuery('');
    setIsSearchOpen(false);
    if (result.type === 'Device' && result.id) {
      setSelectedDeviceId(result.id);
      setIsDeviceModalOpen(true);
    } else if (['User', 'Store', 'Lab'].includes(result.type) && result.id) {
      setSelectedUserId(result.id);
      setIsUserModalOpen(true);
    } else {
      router.push(result.url);
    }
  }

  const getIconForType = (type: string) => {
    switch (type) {
      case 'Device': return <Smartphone className="h-4 w-4" />;
      case 'User': return <User className="h-4 w-4" />;
      case 'Store': return <Store className="h-4 w-4" />;
      case 'Lab': return <Wrench className="h-4 w-4" />;
      case 'Repair': return <Wrench className="h-4 w-4" />;
      default: return <Search className="h-4 w-4" />;
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4">
        {/* Logo and title */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center justify-center h-12 w-12 rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">לוח בקרה - מנהל</h2>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground flex items-center justify-center">
              {isSearchLoading ? <Spinner /> : <Search />}
            </div>
            <Input
              type="search"
              placeholder="חיפוש..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.length > 2 && setIsSearchOpen(true)}
              onBlur={() => setTimeout(() => setIsSearchOpen(false), 100)}
            />
            {isSearchOpen && (
              <div className="absolute top-full mt-2 w-full rounded-md border bg-background shadow-lg z-50">
                {searchResults.length > 0 ? (
                  searchResults.map((result, index) => (
                    <div 
                      key={index} 
                      className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer" 
                      onMouseDown={() => handleSearchResultClick(result)}
                    >
                      {getIconForType(result.type)}
                      <div>
                        <p className="text-sm font-medium">{result.title}</p>
                        <p className="text-xs text-muted-foreground">{result.description}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {isSearchLoading ? 'מחפש...' : 'אין תוצאות'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {/* Notifications */}
          <NotificationsDropdown />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="/avatar.png" alt={user?.full_name ?? undefined} />
                  <AvatarFallback>
                    {user?.full_name?.split(' ').map((n: string) => n[0]).join('') || 'A'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            {/* align the dropdown menu to the right */}
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-1 text-right">
                  <p className="text-sm font-medium">{user?.full_name || 'מנהל'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/admin/profile')} className="gap-2 justify-end">
                <User className="h-4 w-4" />
                <span>פרופיל</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/admin/settings')} className="gap-2 justify-end">
                <Settings className="h-4 w-4" />
                <span>הגדרות</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive gap-2 justify-end" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                <span>התנתק</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <DeviceDetailsModal 
        deviceId={selectedDeviceId}
        open={isDeviceModalOpen}
        onOpenChange={setIsDeviceModalOpen}
        onDeviceUpdate={() => { /* can optionally refresh data here */ }}
      />
      <UserDetailsModal 
        userId={selectedUserId}
        open={isUserModalOpen}
        onOpenChange={setIsUserModalOpen}
        onUserUpdate={() => { /* can optionally refresh data here */ }}
      />
    </header>
  )
}
