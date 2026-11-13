'use client'

// MikuAI — Settings: profile, learning preferences, password, account info.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UserRound, KeyRound, LogOut, ShieldCheck, Database } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiPost, apiPatch } from '@/lib/client/api'
import { SUPPORTED_LANGUAGES, LEVELS } from '@/lib/languages'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { SessionUser } from '@/lib/types'

export function SettingsView({ user }: { user: SessionUser }) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(user.displayName ?? '')
  const [username, setUsername] = useState(user.username ?? '')
  const [nativeLanguage, setNativeLanguage] = useState(user.nativeLanguage)
  const [targetLanguage, setTargetLanguage] = useState(user.targetLanguage)
  const [level, setLevel] = useState(user.level)
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  async function saveProfile() {
    if (!displayName.trim()) {
      toast.error('Nama tampilan tidak boleh kosong.')
      return
    }
    setSavingProfile(true)
    try {
      await apiPatch('/api/auth/profile', {
        displayName: displayName.trim(),
        username: username.trim() || null,
        nativeLanguage,
        targetLanguage,
        level,
      })
      toast.success('Profil diperbarui.')
      router.refresh()
    } catch {
      /* handled */
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword() {
    if (!currentPassword) {
      toast.error('Kata sandi saat ini wajib diisi.')
      return
    }
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error('Kata sandi baru minimal 8 karakter dengan huruf dan angka.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi kata sandi tidak cocok.')
      return
    }
    setSavingPassword(true)
    try {
      await apiPost('/api/auth/password-change', { currentPassword, newPassword })
      toast.success('Kata sandi berhasil diubah.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      /* handled */
    } finally {
      setSavingPassword(false)
    }
  }

  async function signOut() {
    try {
      await apiPost('/api/auth/logout')
      router.push('/login')
      router.refresh()
    } catch {
      /* handled */
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 animate-fade-up">
      {/* Profile */}
      <Card className="border-border bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <UserRound size={16} className="text-primary" /> Profil & Preferensi Belajar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-name">Nama tampilan</Label>
              <Input id="s-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} className="text-[13.5px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-username">Username</Label>
              <Input id="s-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="opsional" className="text-[13.5px]" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-native">Bahasa ibu</Label>
              <Select value={nativeLanguage} onValueChange={setNativeLanguage}>
                <SelectTrigger id="s-native" className="text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.name}>{l.flag} {l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-target">Bahasa fokus</Label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger id="s-target" className="text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.name}>{l.flag} {l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-level">Level belajar</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as SessionUser['level'])}>
              <SelectTrigger id="s-level" className="text-[13px] w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11.5px] text-silver/70">Mempengarisasi kompleksitas jawaban AI Tutor, soal kuis, dan rekomendasi pelajaran.</p>
          </div>
          <Button onClick={saveProfile} disabled={savingProfile} className="bg-primary hover:bg-primary/90">
            {savingProfile ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
            Simpan Profil
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {/* Password */}
        <Card className="border-border bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <KeyRound size={16} className="text-primary" /> Ubah Kata Sandi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-cur">Kata sandi saat ini</Label>
              <Input id="s-cur" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" className="text-[13.5px]" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s-new">Kata sandi baru</Label>
                <Input id="s-new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" className="text-[13.5px]" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-conf">Ulangi baru</Label>
                <Input id="s-conf" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" className="text-[13.5px]" />
              </div>
            </div>
            <Button onClick={savePassword} disabled={savingPassword} variant="outline" className="text-foreground">
              {savingPassword ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
              Perbarui Kata Sandi
            </Button>
          </CardContent>
        </Card>

        {/* Account info */}
        <Card className="border-border bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Database size={16} className="text-primary" /> Informasi Akun
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-silver">Email</span>
              <span className="text-foreground font-medium">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-silver">Role</span>
              <Badge variant="outline" className="capitalize border-[rgba(168,183,204,0.25)] text-silver">{user.role}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-silver">Bergabung sejak</span>
              <span className="text-foreground">{new Date(user.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-silver">Autentikasi</span>
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                {isSupabaseConfigured() ? 'Supabase Auth' : 'Sesi lokal (pratinjau)'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-silver">Data belajar</span>
              <span className="inline-flex items-center gap-1 text-foreground">
                <ShieldCheck size={13} className="text-[#43d0a0]" /> Privat (RLS)
              </span>
            </div>
            <Button variant="destructive" className="w-full mt-2" onClick={signOut}>
              <LogOut size={14} className="mr-1.5" /> Keluar dari Akun
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
