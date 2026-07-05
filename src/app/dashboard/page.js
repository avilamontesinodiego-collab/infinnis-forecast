'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/layout'
import Navbar from '@/components/Navbar'
import dynamic from 'next/dynamic'

const DashboardBoard = dynamic(() => import('@/components/DashboardBoard'), { ssr: false })

export default function DashboardPage() {
  const { user, role, loading, appEnabled } = useAuth()
  const router = useRouter()

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading, router])

  if (loading || !user) return null

  if (!appEnabled && role !== 'admin') {
    return (
      <div style={{ minHeight:'100vh', background:'#eef2f7', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ background:'#fff', padding:48, borderRadius:8, textAlign:'center', border:'1px solid #c8d6e5' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
          <h2 style={{ color:'#1a2b3c', marginBottom:8 }}>Aplicación desactivada</h2>
          <p style={{ color:'#5a6f82' }}>El administrador ha desactivado temporalmente el acceso.</p>
        </div>
      </div>
    )
  }

  if (role === 'pending') {
    return (
      <div style={{ minHeight:'100vh', background:'#eef2f7', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ background:'#fff', padding:48, borderRadius:8, textAlign:'center', border:'1px solid #c8d6e5' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>⏳</div>
          <h2 style={{ color:'#1a2b3c', marginBottom:8 }}>Acceso pendiente</h2>
          <p style={{ color:'#5a6f82' }}>Tu cuenta está pendiente de aprobación por el administrador.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:'#eef2f7' }}>
      <Navbar />
      <DashboardBoard />
    </div>
  )
}
