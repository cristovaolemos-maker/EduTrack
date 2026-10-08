import { useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Route, Switch, Link, useLocation, Router as WouterRouter } from 'wouter';
import {
  Activity, ArrowDownRight, ArrowRight, Bell, BookOpen, CalendarDays,
  Check, ChevronDown, CircleHelp, ClipboardCheck, FileBarChart2, GraduationCap,
  LayoutDashboard, LogOut, Menu, Plus, Search, ShieldCheck, Users, X, UserRound,
} from 'lucide-react';
import {
  useHealthCheck, useLogin, useLogout, useGetCurrentUser, useGetDashboard,
  useListStudents, useCreateStudent, useListTeachers, useCreateTeacher,
  useListSubjects, useCreateSubject, useListClasses, useCreateClass, useGetClass,
  useCreateEnrollment, useListAssessments, useCreateAssessment, useListGrades,
  useUpsertGrade, useListAttendance, useRecordAttendance, useListAnnouncements,
  useCreateAnnouncement, useGetAcademicReport, useListAuditLogs,
  getGetCurrentUserQueryKey, getGetDashboardQueryKey, getListStudentsQueryKey,
  getListTeachersQueryKey, getListSubjectsQueryKey, getListClassesQueryKey,
  getListAssessmentsQueryKey, getListGradesQueryKey, getListAttendanceQueryKey,
  getListAnnouncementsQueryKey, getGetAcademicReportQueryKey, getListAuditLogsQueryKey, getGetClassQueryKey,
  getHealthCheckQueryKey,
} from '@workspace/api-client-react';
import type { Student, Teacher, Subject, Classroom, Assessment, Grade, Attendance, Announcement } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import './index.css';

const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 20_000, refetchOnWindowFocus: false } } });
type Role = 'admin' | 'teacher' | 'student';
type SessionData = { user: { id: number; name: string; email: string; role: string; status: string }; studentId?: number | null; teacherId?: number | null };
type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; roles?: Role[] };
const nav: NavItem[] = [
  { href: '/dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/alunos', label: 'Alunos', icon: Users, roles: ['admin', 'teacher'] },
  { href: '/professores', label: 'Professores', icon: UserRound, roles: ['admin'] },
  { href: '/disciplinas', label: 'Disciplinas', icon: BookOpen, roles: ['admin'] },
  { href: '/turmas', label: 'Turmas', icon: GraduationCap },
  { href: '/matriculas', label: 'Matrículas', icon: ClipboardCheck, roles: ['admin'] },
  { href: '/avaliacoes', label: 'Avaliações', icon: CalendarDays },
  { href: '/notas', label: 'Notas', icon: FileBarChart2 },
  { href: '/frequencia', label: 'Frequência', icon: Check },
  { href: '/avisos', label: 'Avisos', icon: Bell },
  { href: '/relatorios', label: 'Relatórios', icon: FileBarChart2, roles: ['admin', 'teacher'] },
  { href: '/auditoria', label: 'Auditoria', icon: ShieldCheck, roles: ['admin'] },
];
const pageNames: Record<string, string> = Object.fromEntries(nav.map((n) => [n.href, n.label]));
const roleName: Record<Role, string> = { admin: 'Administrador', teacher: 'Professor(a)', student: 'Estudante' };

function Brand({ inverse = false }: { inverse?: boolean }) {
  return <span className={`inline-flex items-center gap-2.5 ${inverse ? 'text-[#f5f2e8]' : 'text-[#26384a]'}`}>
    <span className={`grid h-9 w-9 place-items-center rounded-xl ${inverse ? 'bg-[#a1d9bd] text-[#203747]' : 'bg-[#236a56] text-[#f7f4e9]'}`}>
      <GraduationCap size={20} strokeWidth={2.2} />
    </span><span className="font-[var(--app-font-serif)] text-[19px] font-extrabold tracking-[-.045em]">edu<span className={inverse ? 'text-[#a1d9bd]' : 'text-[#28765e]'}>track</span></span>
  </span>;
}
function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-primary">{eyebrow ?? 'EDUTRACK · GESTÃO ACADÊMICA'}</p><h1 className="font-[var(--app-font-serif)] text-3xl font-bold tracking-[-.045em] text-[#26384a] md:text-[36px]">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}</div>{action}
  </div>;
}
function LoadState({ error, loading, onRetry }: { error?: boolean; loading?: boolean; onRetry?: () => void }) {
  if (loading) return <div className="grid gap-3" aria-label="Carregando"><div className="h-16 animate-pulse rounded-2xl bg-muted"/><div className="h-16 animate-pulse rounded-2xl bg-muted"/><div className="h-16 animate-pulse rounded-2xl bg-muted"/></div>;
  if (error) return <div className="rounded-2xl border border-[#e9c6bc] bg-[#fff6f1] p-6 text-sm text-[#704439]"><strong>Não foi possível carregar estas informações.</strong><p className="mt-1">Confira sua conexão e tente novamente.</p>{onRetry && <Button variant="outline" className="mt-4" onClick={onRetry}>Tentar novamente</Button>}</div>;
  return null;
}
function Empty({ title = 'Ainda não há registros', detail = 'Quando houver informações disponíveis, elas aparecerão aqui.' }: { title?: string; detail?: string }) {
  return <div className="rounded-2xl border border-dashed border-[#d9d8cb] bg-[#faf9f3] px-6 py-12 text-center"><span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-[#e5efe7] text-primary"><BookOpen size={19}/></span><p className="font-semibold text-[#33495a]">{title}</p><p className="mt-1 text-sm text-muted-foreground">{detail}</p></div>;
}
function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[20px] border border-[#e7e4d8] bg-card p-5 shadow-[0_8px_24px_rgba(46,57,47,.035)] md:p-6 ${className}`}>{children}</section>;
}
function errorText(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return 'Algo não saiu como esperado. Tente novamente.';
}

function PublicHome() {
  const [menuOpen, setMenuOpen] = useState(false);
  return <main className="grain min-h-[100dvh] overflow-hidden bg-[#f5f3e9] text-[#273a4b]">
    <header className="relative z-10 mx-auto flex max-w-[1280px] items-center justify-between px-5 py-5 md:px-10">
      <Link href="/" className="no-underline"><Brand/></Link>
      <nav className="hidden items-center gap-8 text-sm font-semibold text-[#566575] md:flex"><a href="#plataforma" className="transition hover:text-primary">Plataforma</a><a href="#proposito" className="transition hover:text-primary">Nosso propósito</a><a href="#seguranca" className="transition hover:text-primary">Confiabilidade</a></nav>
      <div className="hidden items-center gap-3 md:flex"><Link href="/login" className="px-4 py-2 text-sm font-semibold text-[#344c5a]">Acessar sistema</Link><Link href="/login" className="rounded-xl bg-[#236a56] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#1c5948]">Entrar na plataforma <ArrowRight className="ml-2 inline" size={15}/></Link></div>
      <button aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} className="grid h-10 w-10 place-items-center rounded-xl border border-[#deded2] md:hidden" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={19}/> : <Menu size={19}/>}</button>
    </header>
    {menuOpen && <div className="relative z-20 mx-5 grid gap-3 rounded-2xl border bg-[#fcfbf6] p-4 md:hidden"><a href="#plataforma" onClick={() => setMenuOpen(false)}>Plataforma</a><a href="#proposito" onClick={() => setMenuOpen(false)}>Nosso propósito</a><Link href="/login" className="font-bold text-primary">Acessar sistema</Link></div>}
    <section className="relative mx-auto grid max-w-[1280px] items-center gap-10 px-5 pb-20 pt-12 md:grid-cols-[1.04fr_.96fr] md:px-10 md:pb-28 md:pt-16">
      <div className="enter relative z-10">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#d6e1d5] bg-[#e8efe5] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.13em] text-[#28644f]"><span className="h-1.5 w-1.5 rounded-full bg-[#4b9a72]"/> Gestão escolar com mais presença</div>
        <h1 className="max-w-[700px] font-[var(--app-font-serif)] text-[48px] font-extrabold leading-[1.02] tracking-[-.065em] md:text-[76px]">O cuidado com a escola, <span className="relative inline-block text-[#28745b]">em cada detalhe.</span></h1>
        <p className="mt-7 max-w-[535px] text-base leading-7 text-[#65717a] md:text-lg">Uma rotina acadêmica mais clara para quem ensina, aprende e faz a escola acontecer. Registros confiáveis, progresso visível e tempo de volta para o que importa.</p>
        <div className="mt-8 flex flex-wrap items-center gap-4"><Link href="/login" className="rounded-xl bg-[#236a56] px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_22px_rgba(35,106,86,.2)] transition hover:-translate-y-0.5">Acessar EduTrack <ArrowRight className="ml-2 inline" size={16}/></Link><a href="#plataforma" className="px-2 py-3 text-sm font-bold text-[#526473]">Conhecer a plataforma <ArrowDownRight className="ml-1 inline" size={16}/></a></div>
        <div className="mt-12 flex items-center gap-4 border-t border-[#deded3] pt-5"><div className="flex -space-x-2"><span className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#f5f3e9] bg-[#d3e8dc] text-xs font-bold text-[#306550]">AD</span><span className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#f5f3e9] bg-[#f1d9c8] text-xs font-bold text-[#805139]">PR</span><span className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#f5f3e9] bg-[#d9e4ec] text-xs font-bold text-[#38546a]">ES</span></div><p className="text-xs leading-5 text-[#6d7981]">Feito para a comunidade escolar<br/><strong className="text-[#344b59]">de ponta a ponta.</strong></p></div>
      </div>
      <div className="enter delay-1 relative mx-auto w-full max-w-[570px]">
        <div className="absolute -right-10 -top-12 h-60 w-60 rounded-full bg-[#dbe9d7] blur-3xl"/>
        <div className="relative overflow-hidden rounded-[30px] border border-[#d8ded3] bg-[#fbfaf4] p-4 shadow-[0_28px_70px_rgba(36,54,50,.12)] md:rotate-[1.2deg] md:p-5">
          <div className="flex items-center justify-between border-b border-[#ece9de] pb-4"><div className="flex items-center gap-3"><Brand/><span className="hidden border-l border-[#deded3] pl-3 text-xs text-[#778087] sm:inline">Painel escolar</span></div><div className="grid h-8 w-8 place-items-center rounded-full bg-[#e9efe7] text-[#36725c]"><Bell size={15}/></div></div>
          <div className="px-1 pb-1 pt-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#89918f]">TERÇA-FEIRA, 18 DE MARÇO</p><h2 className="mt-1 font-[var(--app-font-serif)] text-2xl font-bold tracking-[-.04em]">Bom dia, equipe.</h2></div>
          <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-[#e6f0e7] p-4"><p className="text-[11px] font-medium text-[#64766a]">Registros em dia</p><p className="mt-2 font-[var(--app-font-serif)] text-3xl font-bold text-[#236a56]">+</p><p className="mt-1 text-[10px] text-[#748077]">Acompanhe cada avanço</p></div><div className="rounded-2xl bg-[#f5e9dc] p-4"><p className="text-[11px] font-medium text-[#857060]">Próxima avaliação</p><p className="mt-2 font-[var(--app-font-serif)] text-lg font-bold text-[#725840]">Matemática</p><p className="mt-1 text-[10px] text-[#8b7c6e]">Agenda organizada</p></div></div>
          <div className="mt-3 rounded-2xl border border-[#ece9de] bg-white/70 p-4"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold">A escola em movimento</p><span className="text-[10px] text-[#778087]">Acompanhamento</span></div><div className="flex h-[108px] items-end gap-2 border-b border-[#e7e5dc] px-2">{[38,55,48,70,61,83,72,94,76,100,88,112].map((h,i)=><div key={i} className={`flex-1 rounded-t-md ${i===9?'bg-[#28745b]':'bg-[#cae1d1]'}`} style={{height:`${h*.72}px`}}/>)}</div><div className="mt-2 flex justify-between text-[9px] text-[#939891]"><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SEMANA</span></div></div>
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#f0eee5] p-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#fffaf0] text-[#bc7756]"><CalendarDays size={17}/></span><div className="flex-1"><p className="text-[11px] font-bold">Aviso da coordenação</p><p className="mt-0.5 text-[10px] text-[#7e817d]">Planejamento pedagógico · 14h30</p></div><ArrowRight size={15} className="text-[#728078]"/></div>
        </div>
        <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-[#dae2d5] bg-[#fbfaf4] px-4 py-3 shadow-lg md:block"><p className="text-[10px] font-bold uppercase tracking-wider text-[#789083]">Tudo em seu lugar</p><p className="mt-1 text-sm font-bold text-[#2f5347]">Uma rotina mais leve.</p></div>
      </div>
    </section>
    <section id="plataforma" className="bg-[#e9eee4] px-5 py-20 md:px-10 md:py-28"><div className="mx-auto max-w-[1160px]">
      <div className="grid gap-8 md:grid-cols-[.82fr_1.18fr]"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#37775e]">Uma base confiável</p><h2 className="mt-4 max-w-md font-[var(--app-font-serif)] text-4xl font-bold leading-tight tracking-[-.05em] md:text-5xl">Menos ruído. Mais espaço para aprender.</h2></div><p className="max-w-xl self-end text-[15px] leading-7 text-[#67766e]">Da matrícula à avaliação, cada informação tem um lugar claro. EduTrack aproxima a gestão do cotidiano escolar — sem tirar o lado humano de vista.</p></div>
      <div className="mt-12 grid gap-4 md:grid-cols-3"><Feature index="01" icon={<ClipboardCheck size={19}/>} title="Registros que inspiram confiança" text="Dados acadêmicos organizados, com histórico e rastreabilidade para decisões tranquilas."/><Feature index="02" icon={<Activity size={19}/>} title="Progresso que faz sentido" text="Notas, presença e próximos passos reunidos para apoiar cada trajetória de aprendizagem."/><Feature index="03" icon={<Users size={19}/>} title="Uma comunidade alinhada" text="Administradores, professores e estudantes encontram a informação certa para seu papel."/></div>
    </div></section>
    <section id="proposito" className="mx-auto grid max-w-[1160px] items-center gap-10 px-5 py-20 md:grid-cols-2 md:px-10 md:py-28"><div className="relative min-h-[300px] overflow-hidden rounded-[28px] bg-[#283f4a] p-7 text-[#f6f2e8] md:min-h-[390px] md:p-10"><div className="absolute -right-8 -top-8 h-56 w-56 rounded-full border border-[#98cbb2]/30"/><div className="absolute right-6 top-10 h-40 w-40 rounded-full border border-[#98cbb2]/30"/><div className="absolute -bottom-16 left-10 h-64 w-64 rounded-full border border-[#98cbb2]/25"/><div className="relative flex h-full min-h-[250px] flex-col justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#a1d9bd] text-[#253f49]"><GraduationCap/></span><div><p className="max-w-[330px] font-[var(--app-font-serif)] text-3xl font-bold leading-tight tracking-[-.04em]">Cada dado conta uma história. Cada história merece atenção.</p><p className="mt-5 text-sm text-[#c2d5d0]">Educação se faz em conjunto.</p></div></div></div><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#37775e]">Tecnologia com propósito</p><h2 className="mt-4 font-[var(--app-font-serif)] text-4xl font-bold tracking-[-.05em] md:text-[48px]">A escola não é feita de planilhas.</h2><p className="mt-5 text-[15px] leading-7 text-[#66747b]">É feita de pessoas que acompanham, acolhem e abrem caminhos. Por isso, criamos uma plataforma que transforma a operação escolar em tempo e clareza para cuidar melhor de cada aluno.</p><Link href="/login" className="mt-7 inline-flex items-center font-bold text-[#286b55]">Conheça o ambiente escolar <ArrowRight className="ml-2" size={16}/></Link></div></section>
    <section id="seguranca" className="border-y border-[#e4e2d7] bg-[#faf9f3] px-5 py-16 md:px-10"><div className="mx-auto grid max-w-[1160px] items-center gap-8 md:grid-cols-[1fr_2fr]"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#37775e]">Clareza também é segurança</p><h2 className="mt-3 font-[var(--app-font-serif)] text-3xl font-bold tracking-[-.04em]">Informação bem cuidada, todos os dias.</h2></div><div className="grid gap-6 sm:grid-cols-3"><SmallTrust title="Acesso por perfil" text="Cada pessoa vê o que precisa para sua rotina."/><SmallTrust title="Histórico rastreável" text="Ações importantes ficam registradas."/><SmallTrust title="Dados organizados" text="Uma fonte clara para toda a comunidade."/></div></div></section>
    <footer className="mx-auto flex max-w-[1280px] flex-col gap-4 px-5 py-8 text-sm text-[#758079] md:flex-row md:items-center md:justify-between md:px-10"><Brand/><span>© 2025 EduTrack · Gestão acadêmica com cuidado.</span><Link href="/login" className="font-semibold text-[#286b55]">Acessar plataforma <ArrowRight className="ml-1 inline" size={14}/></Link></footer>
  </main>;
}
function Feature({ index, icon, title, text }: { index: string; icon: ReactNode; title: string; text: string }) {
  return <article className="group rounded-[20px] border border-[#dbe2d8] bg-[#f5f5ed] p-6 transition duration-200 hover:-translate-y-1 hover:border-[#a9c6b3]"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#dcebe0] text-[#286b55]">{icon}</span><span className="font-mono text-xs text-[#89968d]">{index}</span></div><h3 className="mt-7 font-[var(--app-font-serif)] text-xl font-bold tracking-[-.03em]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#6b7870]">{text}</p></article>;
}
function SmallTrust({ title, text }: { title: string; text: string }) { return <div className="border-l-2 border-[#91b9a0] pl-4"><p className="font-bold text-[#344a50]">{title}</p><p className="mt-1 text-sm leading-5 text-[#77817b]">{text}</p></div>; }

function LoginPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ data: { email, password } }, { onSuccess: (session) => {
      queryClient.setQueryData(getGetCurrentUserQueryKey(), session);
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      setLocation('/dashboard');
    } });
  };
  return <main className="grid min-h-[100dvh] bg-[#f5f3e9] md:grid-cols-[1fr_.86fr]">
    <section className="grain relative hidden overflow-hidden bg-[#263e49] p-12 text-[#f5f2e8] md:flex md:flex-col md:justify-between lg:p-16"><div className="absolute -right-20 top-20 h-[420px] w-[420px] rounded-full border border-[#95c7ad]/20"/><div className="absolute -right-5 top-36 h-[280px] w-[280px] rounded-full border border-[#95c7ad]/20"/><Link href="/" className="relative"><Brand inverse/></Link><div className="relative max-w-[540px]"><p className="mb-5 text-xs font-bold uppercase tracking-[.18em] text-[#a1d9bd]">Bem-vindo de volta</p><h1 className="font-[var(--app-font-serif)] text-[54px] font-bold leading-[1.04] tracking-[-.06em] lg:text-[68px]">A escola inteira, na mesma direção.</h1><p className="mt-6 max-w-md text-base leading-7 text-[#bdcbc8]">Entre para acompanhar sua comunidade escolar com clareza, confiança e cuidado.</p></div><p className="relative text-xs text-[#9fb2b0]">EduTrack · Gestão acadêmica feita para o dia a dia.</p></section>
    <section className="flex items-center justify-center px-5 py-10"><div className="w-full max-w-[420px] enter"><Link href="/" className="mb-12 inline-flex md:hidden"><Brand/></Link><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Portal escolar</p><h2 className="mt-3 font-[var(--app-font-serif)] text-4xl font-bold tracking-[-.05em]">Acesse sua conta.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Use seu e-mail institucional e senha para continuar.</p>
      <form className="mt-8 space-y-5" onSubmit={submit}><label className="block text-sm font-semibold text-[#344b59]">E-mail institucional<Input data-testid="input-email" autoComplete="username" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="nome@escola.edu.br" className="mt-2 h-12 rounded-xl border-[#d8d9d0] bg-[#fbfaf5]"/></label><label className="block text-sm font-semibold text-[#344b59]">Senha<div className="relative mt-2"><Input data-testid="input-password" autoComplete="current-password" type={visible?'text':'password'} required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha" className="h-12 rounded-xl border-[#d8d9d0] bg-[#fbfaf5] pr-16"/><button type="button" onClick={()=>setVisible(!visible)} className="absolute inset-y-0 right-3 text-xs font-bold text-[#64777b]">{visible?'Ocultar':'Mostrar'}</button></div></label><div className="flex justify-end"><Link href="/forgot-password" className="text-sm font-semibold text-primary">Esqueceu a senha?</Link></div>
        {login.isError && <div role="alert" className="rounded-xl border border-[#e8c9bd] bg-[#fff4ef] px-4 py-3 text-sm text-[#7d4539]">{errorText(login.error)}</div>}
        <Button data-testid="button-login" type="submit" disabled={login.isPending} className="h-12 w-full rounded-xl bg-[#236a56] font-bold hover:bg-[#1c5948]">{login.isPending?'Entrando…':'Entrar na plataforma'} {!login.isPending && <ArrowRight className="ml-2" size={16}/>}</Button>
      </form><p className="mt-7 text-center text-xs leading-5 text-[#7e8786]">O acesso é destinado a pessoas vinculadas à instituição.<br/>Precisa de ajuda? Procure a secretaria escolar.</p>
    </div></section>
  </main>;
}
function ForgotPage() {
  return <main className="grid min-h-[100dvh] place-items-center bg-[#f5f3e9] px-5 py-10"><div className="w-full max-w-[480px] rounded-[24px] border border-[#e6e2d6] bg-[#fbfaf5] p-7 shadow-[0_16px_45px_rgba(40,54,47,.06)] md:p-10"><Link href="/" className="inline-flex"><Brand/></Link><span className="mt-9 grid h-12 w-12 place-items-center rounded-2xl bg-[#e8efe5] text-primary"><CircleHelp/></span><h1 className="mt-6 font-[var(--app-font-serif)] text-3xl font-bold tracking-[-.04em]">Vamos ajudar você a voltar.</h1><p className="mt-3 text-sm leading-6 text-[#6e7a7c]">Para proteger sua conta, a recuperação de acesso é feita com o apoio da equipe da escola.</p><div className="mt-6 rounded-2xl border border-[#e1e6dc] bg-[#f1f4eb] p-4"><p className="text-sm font-bold text-[#334b43]">O que fazer agora</p><p className="mt-1 text-sm leading-6 text-[#65736d]">Entre em contato com a secretaria ou com a pessoa responsável pelo sistema na sua instituição. Ela poderá orientar a redefinição de suas credenciais.</p></div><Link href="/login" className="mt-7 flex h-12 items-center justify-center rounded-xl bg-[#236a56] text-sm font-bold text-white hover:bg-[#1c5948]">Voltar ao acesso <ArrowRight size={16} className="ml-2"/></Link><p className="mt-4 text-center text-xs text-[#828b87]">Esta página não envia e-mails de redefinição.</p></div></main>;
}

function AppShell({ children, session }: { children: ReactNode; session: SessionData }) {
  const [path, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const queryClient = useQueryClient();
  const logout = useLogout();
  const currentRole = session.user.role as Role;
  const visibleNav = nav.filter(item => !item.roles || item.roles.includes(currentRole));
  const title = pageNames[path] ?? (path.startsWith('/turmas/') ? 'Detalhe da turma' : 'Meu perfil');
  return <div className="min-h-[100dvh] bg-[#f5f3e9] text-[#283a4a]">
    {mobileOpen && <button aria-label="Fechar navegação" onClick={()=>setMobileOpen(false)} className="fixed inset-0 z-30 bg-[#1d2f36]/40 md:hidden"/>}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#263e49] px-4 pb-4 pt-6 text-[#f5f2e8] transition-transform duration-200 md:translate-x-0 ${mobileOpen?'translate-x-0':'-translate-x-full'}`}>
      <div className="mb-8 flex items-center justify-between px-2"><Link href="/dashboard" onClick={()=>setMobileOpen(false)}><Brand inverse/></Link><button aria-label="Fechar navegação" className="md:hidden" onClick={()=>setMobileOpen(false)}><X size={18}/></button></div>
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-[#9bb2b0]">Espaço escolar</p>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">{visibleNav.map(item=>{const active=path===item.href || (item.href==='/turmas'&&path.startsWith('/turmas/'));const Icon=item.icon;return <Link key={item.href} href={item.href} onClick={()=>setMobileOpen(false)} data-testid={`link-nav-${item.href.slice(1)}`} className={`nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold ${active?'bg-[#38525a] text-[#b9e2c9] shadow-inner':'text-[#ced9d4] hover:bg-[#304951] hover:text-white'}`}><Icon size={17} strokeWidth={1.9}/>{item.label}{active&&<span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#a1d9bd]"/>}</Link>})}</nav>
      <div className="mt-4 border-t border-[#405761] pt-4"><Link href="/perfil" className={`flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[#304951] ${path==='/perfil'?'bg-[#38525a]':''}`}><span className="grid h-9 w-9 place-items-center rounded-full bg-[#b4d9c2] text-xs font-bold text-[#263e49]">{session.user.name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-xs">{session.user.name}</strong><small className="text-[10px] text-[#a9bfba]">{roleName[currentRole] ?? 'Usuário'}</small></span><ChevronDown size={15} className="text-[#9bb2b0]"/></Link><button data-testid="button-logout" onClick={()=>logout.mutate(undefined,{onSuccess:()=>{queryClient.clear();queryClient.removeQueries({queryKey:getGetCurrentUserQueryKey()})}})} disabled={logout.isPending} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#bac9c4] transition hover:bg-[#304951] hover:text-white"><LogOut size={15}/>{logout.isPending?'Saindo…':'Sair da conta'}</button>{logout.isError&&<p role="alert" className="px-3 pt-2 text-[11px] text-[#ffbcb0]">{errorText(logout.error)}</p>}</div>
    </aside>
    <div className="min-h-[100dvh] md:pl-[260px]">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#e5e2d7] bg-[#f8f7f0]/95 px-4 backdrop-blur-md md:px-8"><div className="flex items-center gap-3"><button onClick={()=>setMobileOpen(true)} aria-label="Abrir navegação" className="grid h-9 w-9 place-items-center rounded-xl border border-[#deddd2] md:hidden"><Menu size={18}/></button><div><p className="hidden text-[10px] font-bold uppercase tracking-[.14em] text-[#89918c] sm:block">Escola Horizonte · 2025</p><p className="font-[var(--app-font-serif)] text-lg font-bold tracking-[-.035em]">{title}</p></div></div><div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-xl border border-[#e4e1d6] bg-[#fbfaf5] px-3 py-2 text-xs text-[#7d8985] lg:flex"><Search size={14}/><span>Encontre uma informação</span><kbd className="ml-8 rounded border border-[#e4e1d6] px-1.5 py-0.5 text-[10px]">⌘ K</kbd></div><button onClick={()=>setLocation('/avisos')} aria-label="Avisos" className="relative grid h-9 w-9 place-items-center rounded-xl border border-[#e4e1d6] bg-[#fbfaf5] text-[#516a68]"><Bell size={17}/><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#c6795a]"/></button><span className="hidden text-xs font-semibold text-[#576970] sm:block">{session.user.name.split(' ')[0]}</span><Link href="/perfil" className="grid h-9 w-9 place-items-center rounded-full bg-[#dcebe0] text-xs font-bold text-[#286b55]">{session.user.name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}</Link></div></header>
      <main className="mx-auto max-w-[1500px] px-4 py-7 md:px-8 md:py-9">{children}</main>
      <footer className="mx-4 border-t border-[#e3e0d5] px-0 py-5 text-[11px] text-[#929a94] md:mx-8">EduTrack <span className="px-1.5">·</span> Dados acadêmicos com cuidado e responsabilidade.</footer>
    </div>
  </div>;
}

function DataTable<T>({ columns, rows, empty }: { columns: { label: string; render: (row: T) => ReactNode }[]; rows: T[]; empty?: ReactNode }) {
  if (!rows.length) return <>{empty ?? <Empty/>}</>;
  return <div className="overflow-x-auto rounded-2xl border border-[#e8e5da]"><table className="w-full min-w-[560px] border-collapse text-left text-sm"><thead><tr className="bg-[#f3f2e9]">{columns.map(col=><th key={col.label} className="px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#7d8982]">{col.label}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i} data-testid={`row-record-${i}`} className="border-t border-[#eeece3] transition hover:bg-[#faf9f4]">{columns.map(col=><td key={col.label} className="px-4 py-3.5 text-[#465762]">{col.render(row)}</td>)}</tr>)}</tbody></table></div>;
}
function Status({ value }: { value: string }) { const good=['active','ativo','present','presente','matriculado','true']; const ok=good.includes(String(value).toLowerCase());return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${ok?'bg-[#e2f0e5] text-[#377050]':'bg-[#f6e8df] text-[#9b5e43]'}`}>{value}</span>; }
function DataPage({ title, description, children, eyebrow, action }: { title: string; description?: string; children: ReactNode; eyebrow?: string; action?: ReactNode }) {
  return <div className="enter"><PageHeading title={title} description={description} eyebrow={eyebrow} action={action}/>{children}</div>;
}
function FormDialog({ title, fields, onSubmit, pending, error, onClose, submitText = 'Salvar registro' }: { title: string; fields: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string; options?: { label: string; value: string }[] }[]; onSubmit: (data: Record<string,string>)=>void; pending: boolean; error?: unknown; onClose:()=>void; submitText?:string }) {
  const submit = (e:FormEvent<HTMLFormElement>) => {e.preventDefault(); const form=new FormData(e.currentTarget); const data:Record<string,string>={};fields.forEach(f=>{data[f.name]=String(form.get(f.name)??'')});onSubmit(data)};
  return <div role="presentation" className="fixed inset-0 z-50 grid place-items-center bg-[#1d2f36]/45 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-[22px] border border-[#e4e0d4] bg-[#fbfaf5] p-6 shadow-2xl md:p-7"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Novo registro</p><h2 id="dialog-title" className="mt-1 font-[var(--app-font-serif)] text-2xl font-bold tracking-[-.04em]">{title}</h2></div><button aria-label="Fechar" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><X size={18}/></button></div><form onSubmit={submit} className="mt-6 space-y-4">{fields.map(f=><label key={f.name} className="block text-xs font-bold text-[#475b60]">{f.label}{f.options?<select name={f.name} required={f.required!==false} defaultValue={f.defaultValue??''} className="mt-1.5 h-11 w-full rounded-xl border border-[#d9d9cf] bg-[#fffefa] px-3 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-[#236a56]/15"><option value="" disabled>Selecione uma opção</option>{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<Input name={f.name} type={f.type??'text'} required={f.required!==false} defaultValue={f.defaultValue} min={f.type==='number'?0:undefined} step={f.type==='number'?'any':undefined} className="mt-1.5 h-11 rounded-xl border-[#d9d9cf] bg-[#fffefa] font-medium"/>}</label>)}{!!error&&<p role="alert" className="rounded-xl bg-[#fff2ec] p-3 text-xs text-[#864a3e]">{errorText(error)}</p>}<div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={pending} className="bg-[#236a56] hover:bg-[#1c5948]">{pending?'Salvando…':submitText}</Button></div></form></section></div>;
}
function useWorkspaceQueries() {
  const user = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const studentParams = { page: 1, limit: 100 };
  const students = useListStudents(studentParams, { query: { queryKey: getListStudentsQueryKey(studentParams) } });
  const teachers = useListTeachers({ query: { queryKey: getListTeachersQueryKey() } });
  const subjects = useListSubjects({ query: { queryKey: getListSubjectsQueryKey() } });
  const classes = useListClasses(undefined, { query: { queryKey: getListClassesQueryKey() } });
  const assessments = useListAssessments(undefined, { query: { queryKey: getListAssessmentsQueryKey() } });
  const grades = useListGrades(undefined, { query: { queryKey: getListGradesQueryKey() } });
  const attendance = useListAttendance(undefined, { query: { queryKey: getListAttendanceQueryKey() } });
  const announcements = useListAnnouncements({ query: { queryKey: getListAnnouncementsQueryKey() } });
  const report = useGetAcademicReport(undefined, { query: { queryKey: getGetAcademicReportQueryKey() } });
  const auditParams = { page: 1 };
  const audit = useListAuditLogs(auditParams, { query: { queryKey: getListAuditLogsQueryKey(auditParams) } });
  const dashboard = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey() } });
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  return { user, students, teachers, subjects, classes, assessments, grades, attendance, announcements, report, audit, dashboard, health };
}
function DashboardPage({ data, session }: { data: ReturnType<typeof useWorkspaceQueries>; session: SessionData }) {
  const dashboard=data.dashboard;
  const d=dashboard.data;
  return <div className="enter">
    <PageHeading eyebrow={`PAINEL · ${roleName[session.user.role as Role] ?? 'COMUNIDADE'}`} title={`Olá, ${session.user.name.split(' ')[0]}.`} description="Um retrato claro do que merece sua atenção hoje." action={<span className="inline-flex items-center gap-2 rounded-full border border-[#d9e4d9] bg-[#edf3e9] px-3 py-2 text-xs font-bold text-[#456d58]"><span className="h-1.5 w-1.5 rounded-full bg-[#58a574]"/> Período letivo em andamento</span>}/>
    <LoadState loading={dashboard.isLoading} error={dashboard.isError} onRetry={()=>dashboard.refetch()}/>
    {d && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{d.indicators.map((item,i)=><Panel key={item.label} className="relative overflow-hidden p-5"><div className="flex items-start justify-between"><p className="text-xs font-semibold text-[#73817f]">{item.label}</p><span className={`grid h-8 w-8 place-items-center rounded-xl ${i%2?'bg-[#f4e9df] text-[#ae7455]':'bg-[#e3eee4] text-[#367052]'}`}>{[<Users size={16}/>,<Activity size={16}/>,<ClipboardCheck size={16}/>,<BookOpen size={16}/>][i%4]}</span></div><p className="mt-4 font-[var(--app-font-serif)] text-3xl font-bold tracking-[-.04em]">{item.value.toLocaleString('pt-BR')}</p>{item.detail&&<p className="mt-1 text-xs text-[#87918c]">{item.detail}</p>}</Panel>)}</div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_.8fr]"><Panel><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#84908a]">Acompanhamento</p><h2 className="mt-1 font-[var(--app-font-serif)] text-xl font-bold">Indicadores de desempenho</h2></div><Activity size={18} className="text-primary"/></div>{d.performance.length?<div className="space-y-4">{d.performance.map((item,i)=><div key={item.label}><div className="mb-2 flex justify-between text-xs"><span className="font-semibold text-[#50616a]">{item.label}</span><span className="font-mono text-[#71827b]">{item.value.toLocaleString('pt-BR')}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#ecece2]"><div className={`h-full rounded-full ${i%2?'bg-[#c98764]':'bg-[#428568]'}`} style={{width:`${Math.max(0,Math.min(100,item.value))}%`}}/></div></div>)}</div>:<Empty title="Sem indicadores de desempenho" detail="Os dados serão exibidos quando estiverem disponíveis."/ >}</Panel>
        <Panel><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#84908a]">Agenda</p><h2 className="mt-1 font-[var(--app-font-serif)] text-xl font-bold">Próximas avaliações</h2></div><CalendarDays size={18} className="text-[#bd7958]"/></div>{d.upcoming.length?<div className="space-y-2">{d.upcoming.map(a=><div key={a.id} className="flex items-center gap-3 rounded-xl border border-[#ece8dd] bg-[#fbfaf5] p-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f4e8dd] text-center text-[10px] font-bold leading-3 text-[#925e44]">{new Date(`${a.date}T00:00:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','')}</span><div className="min-w-0"><p className="truncate text-sm font-bold">{a.title}</p><p className="mt-0.5 text-[11px] text-[#84908a]">Turma {a.classId} · peso {a.weight}</p></div></div>)}</div>:<Empty title="Agenda tranquila" detail="Não há avaliações próximas no momento."/>}</Panel></div>
      <Panel className="mt-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#84908a]">Comunicados</p><h2 className="mt-1 font-[var(--app-font-serif)] text-xl font-bold">Avisos para você</h2></div><Link href="/avisos" className="text-xs font-bold text-primary">Ver todos <ArrowRight className="ml-1 inline" size={13}/></Link></div>{d.announcements.length?<div className="grid gap-3 md:grid-cols-2">{d.announcements.slice(0,4).map(a=><article key={a.id} className="rounded-xl border border-[#ece8dd] p-4"><div className="flex justify-between gap-3"><h3 className="text-sm font-bold">{a.title}</h3><span className="shrink-0 text-[10px] text-[#89938e]">{new Date(a.createdAt).toLocaleDateString('pt-BR')}</span></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-[#75817d]">{a.body}</p></article>)}</div>:<Empty title="Nenhum aviso publicado" detail="Quando a escola compartilhar um comunicado, você o encontrará aqui."/>}</Panel>
    </>}
  </div>;
}

function WorkspacePage({ path, data }: { path:string; data:ReturnType<typeof useWorkspaceQueries> }) {
  const qc=useQueryClient();
  const [dialog,setDialog]=useState(false);
  const [search,setSearch]=useState('');
  const createStudent=useCreateStudent(); const createTeacher=useCreateTeacher(); const createSubject=useCreateSubject(); const createClass=useCreateClass(); const createEnrollment=useCreateEnrollment(); const createAssessment=useCreateAssessment(); const upsertGrade=useUpsertGrade(); const recordAttendance=useRecordAttendance(); const createAnnouncement=useCreateAnnouncement();
  const invalidate=async(...keys:readonly (readonly unknown[])[])=>{await Promise.all(keys.map(queryKey=>qc.invalidateQueries({queryKey})))};
  const resetDialog=()=>{setDialog(false)};
  const success=(keys:readonly (readonly unknown[])[])=>()=>{invalidate(...keys);resetDialog()};
  const lower=path.split('/')[1]??'';
  const classes=(data.classes.data??[]);
  const students=data.students.data?.items??[];
  const idOpts=classes.map(c=>({label:`${c.name} · ${c.subjectName}`,value:String(c.id)}));
  const studOpts=students.map(s=>({label:`${s.name} · ${s.registration}`,value:String(s.id)}));
  const addButton=(label='Novo registro')=><Button data-testid="button-add-record" onClick={()=>setDialog(true)} className="rounded-xl bg-[#236a56] hover:bg-[#1c5948]"><Plus size={16} className="mr-2"/>{label}</Button>;
  const actionError=[createStudent,createTeacher,createSubject,createClass,createEnrollment,createAssessment,upsertGrade,recordAttendance,createAnnouncement].find(m=>m.isError)?.error;
  const pending=[createStudent,createTeacher,createSubject,createClass,createEnrollment,createAssessment,upsertGrade,recordAttendance,createAnnouncement].some(m=>m.isPending);
  const failed=(q:{isError:boolean;refetch:()=>unknown})=><LoadState error={q.isError} onRetry={()=>q.refetch()}/>;
  let title=pageNames[path]??'Registros acadêmicos'; let description='Informações organizadas para uma rotina escolar mais clara.'; let content:ReactNode=null; let fields:{name:string;label:string;type?:string;required?:boolean;defaultValue?:string;options?:{label:string;value:string}[]}[]=[]; let save:(form:Record<string,string>)=>void=()=>{};
  if(lower==='alunos'){
    title='Alunos';description='Acompanhe os registros e a situação acadêmica dos estudantes.';fields=[{name:'name',label:'Nome completo'},{name:'email',label:'E-mail',type:'email'},{name:'registration',label:'Matrícula'},{name:'phone',label:'Telefone',required:false},{name:'password',label:'Senha inicial',type:'password'}];save=f=>createStudent.mutate({data:f as never},{onSuccess:success([getListStudentsQueryKey()])});
    const filtered=students.filter(s=>`${s.name} ${s.email} ${s.registration}`.toLowerCase().includes(search.toLowerCase()));
    content=<><div className="mb-4 flex items-center gap-3"><div className="relative max-w-sm flex-1"><Search size={16} className="absolute left-3 top-3 text-[#8b9690]"/><Input aria-label="Buscar alunos" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome, e-mail ou matrícula" className="h-10 rounded-xl border-[#e1ded3] bg-card pl-9"/></div><span className="text-xs text-[#7d8982]">{data.students.data?.total??'—'} registros</span></div>{failed(data.students)}{data.students.isLoading?<LoadState loading/>:<DataTable rows={filtered} columns={[{label:'Estudante',render:s=><div><p className="font-bold text-[#344b59]">{s.name}</p><p className="mt-0.5 text-xs text-[#87918c]">{s.email}</p></div>},{label:'Matrícula',render:s=><span className="font-mono text-xs">{s.registration}</span>},{label:'Telefone',render:s=>s.phone||'—'},{label:'Situação',render:s=><Status value={s.status}/>} ]}/>}</>;
  } else if(lower==='professores'){
    title='Professores';description='Equipe docente, áreas de atuação e vínculos.';fields=[{name:'name',label:'Nome completo'},{name:'email',label:'E-mail',type:'email'},{name:'area',label:'Área de atuação'},{name:'password',label:'Senha inicial',type:'password'}];save=f=>createTeacher.mutate({data:f as never},{onSuccess:success([getListTeachersQueryKey()])});
    content=<>{failed(data.teachers)}{data.teachers.isLoading?<LoadState loading/>:<DataTable rows={(data.teachers.data??[])} columns={[{label:'Professor(a)',render:t=><div><p className="font-bold text-[#344b59]">{t.name}</p><p className="mt-0.5 text-xs text-[#87918c]">{t.email}</p></div>},{label:'Área de atuação',render:t=><span className="rounded-lg bg-[#e8eee5] px-2.5 py-1 text-xs font-semibold text-[#456a57]">{t.area}</span>},{label:'Identificador',render:t=><span className="font-mono text-xs">#{t.id}</span>}]}/>}</>;
  } else if(lower==='disciplinas'){
    title='Disciplinas';description='Componentes curriculares e respectivas cargas horárias.';fields=[{name:'code',label:'Código'},{name:'name',label:'Nome da disciplina'},{name:'workload',label:'Carga horária (horas)',type:'number'}];save=f=>createSubject.mutate({data:{...f,workload:Number(f.workload)} as never},{onSuccess:success([getListSubjectsQueryKey()])});
    content=<>{failed(data.subjects)}{data.subjects.isLoading?<LoadState loading/>:<DataTable rows={data.subjects.data??[]} columns={[{label:'Código',render:s=><span className="rounded-lg bg-[#edf0e8] px-2 py-1 font-mono text-xs font-bold text-[#456653]">{s.code}</span>},{label:'Disciplina',render:s=><strong>{s.name}</strong>},{label:'Carga horária',render:s=>`${s.workload} horas`},{label:'Turmas',render:s=>classes.filter(c=>c.subjectId===s.id).length}]}/>}</>;
  } else if(lower==='turmas'){
    title='Turmas';description='Organize disciplinas, docentes e grupos de aprendizagem.';fields=[{name:'name',label:'Nome da turma'},{name:'term',label:'Período letivo',defaultValue:'2025'},{name:'subjectId',label:'Disciplina',options:(data.subjects.data??[]).map(s=>({label:s.name,value:String(s.id)}))},{name:'teacherId',label:'Professor responsável',options:(data.teachers.data??[]).map(t=>({label:t.name,value:String(t.id)}))}];save=f=>createClass.mutate({data:{...f,subjectId:Number(f.subjectId),teacherId:Number(f.teacherId)} as never},{onSuccess:success([getListClassesQueryKey()])});
    content=<>{failed(data.classes)}{data.classes.isLoading?<LoadState loading/>:<DataTable rows={classes} columns={[{label:'Turma',render:c=><Link href={`/turmas/${c.id}`} className="font-bold text-primary hover:underline">{c.name} <ArrowRight className="ml-1 inline" size={13}/></Link>},{label:'Disciplina',render:c=>c.subjectName},{label:'Docente',render:c=>c.teacherName},{label:'Período',render:c=><span className="rounded-lg bg-[#edf0e8] px-2 py-1 text-xs">{c.term}</span>},{label:'Estudantes',render:c=>c.studentsCount}]}/>}</>;
  } else if(lower==='matriculas'){
    title='Matrículas';description='Vincule estudantes às turmas da instituição.';fields=[{name:'studentId',label:'Estudante',options:studOpts},{name:'classId',label:'Turma',options:idOpts}];save=f=>createEnrollment.mutate({data:{studentId:Number(f.studentId),classId:Number(f.classId)}},{onSuccess:success([getListClassesQueryKey()])});
    content=<Panel className="flex flex-col items-start gap-4 md:flex-row md:items-center"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e7efe5] text-primary"><ClipboardCheck/></span><div><p className="font-bold">Nova matrícula</p><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Escolha o estudante e a turma para registrar o vínculo acadêmico. A confirmação será apresentada após a resposta do sistema.</p></div>{addButton('Registrar matrícula')}</Panel>;
  } else if(lower==='avaliacoes'){
    title='Avaliações';description='Planeje avaliações com data, valor máximo e peso.';fields=[{name:'classId',label:'Turma',options:idOpts},{name:'title',label:'Título da avaliação'},{name:'date',label:'Data',type:'date'},{name:'maxGrade',label:'Nota máxima',type:'number'},{name:'weight',label:'Peso',type:'number'}];save=f=>createAssessment.mutate({data:{...f,classId:Number(f.classId),maxGrade:Number(f.maxGrade),weight:Number(f.weight)} as never},{onSuccess:success([getListAssessmentsQueryKey()])});
    content=<>{failed(data.assessments)}{data.assessments.isLoading?<LoadState loading/>:<DataTable rows={data.assessments.data??[]} columns={[{label:'Avaliação',render:a=><strong>{a.title}</strong>},{label:'Turma',render:a=>classes.find(c=>c.id===a.classId)?.name??`Turma ${a.classId}`},{label:'Data',render:a=>new Date(`${a.date}T00:00:00`).toLocaleDateString('pt-BR')},{label:'Nota máxima',render:a=>a.maxGrade},{label:'Peso',render:a=>a.weight}]}/>}</>;
  } else if(lower==='notas'){
    title='Notas';description='Registre resultados e acompanhe a evolução acadêmica.';fields=[{name:'studentId',label:'Estudante',options:studOpts},{name:'assessmentId',label:'Avaliação',options:(data.assessments.data??[]).map(a=>({label:a.title,value:String(a.id)}))},{name:'value',label:'Nota obtida',type:'number'}];save=f=>upsertGrade.mutate({data:{studentId:Number(f.studentId),assessmentId:Number(f.assessmentId),value:Number(f.value)}},{onSuccess:success([getListGradesQueryKey()])});
    content=<>{addButton('Registrar nota')}<div className="mt-4">{failed(data.grades)}{data.grades.isLoading?<LoadState loading/>:<DataTable rows={data.grades.data??[]} columns={[{label:'Estudante',render:g=>g.studentName||`Estudante ${g.studentId}`},{label:'Avaliação',render:g=>g.assessmentTitle},{label:'Turma',render:g=>classes.find(c=>c.id===g.classId)?.name??`Turma ${g.classId}`},{label:'Nota',render:g=><span className="font-mono font-bold text-[#286b55]">{g.value.toLocaleString('pt-BR')}</span>}]}/>}</div></>;
  } else if(lower==='frequencia'){
    title='Frequência';description='Registre presença com um histórico fácil de consultar.';fields=[{name:'studentId',label:'Estudante',options:studOpts},{name:'classId',label:'Turma',options:idOpts},{name:'date',label:'Data',type:'date',defaultValue:new Date().toISOString().slice(0,10)},{name:'present',label:'Presença',options:[{label:'Presente',value:'true'},{label:'Ausente',value:'false'}]}];save=f=>recordAttendance.mutate({data:{studentId:Number(f.studentId),classId:Number(f.classId),date:f.date,present:f.present==='true'}},{onSuccess:success([getListAttendanceQueryKey()])});
    content=<>{addButton('Registrar frequência')}<div className="mt-4">{failed(data.attendance)}{data.attendance.isLoading?<LoadState loading/>:<DataTable rows={data.attendance.data??[]} columns={[{label:'Estudante',render:a=>a.studentName||`Estudante ${a.studentId}`},{label:'Turma',render:a=>classes.find(c=>c.id===a.classId)?.name??`Turma ${a.classId}`},{label:'Data',render:a=>new Date(`${a.date}T00:00:00`).toLocaleDateString('pt-BR')},{label:'Situação',render:a=><Status value={a.present?'Presente':'Ausente'}/>} ]}/>}</div></>;
  } else if(lower==='avisos'){
    title='Avisos';description='Comunicados importantes para manter a comunidade escolar alinhada.';fields=[{name:'title',label:'Título do aviso'},{name:'body',label:'Mensagem',type:'text'},{name:'audience',label:'Público',options:[{label:'Toda a comunidade',value:'all'},{label:'Administração',value:'admin'},{label:'Professores',value:'teacher'},{label:'Estudantes',value:'student'}]}];save=f=>createAnnouncement.mutate({data:f as never},{onSuccess:success([getListAnnouncementsQueryKey(),getGetDashboardQueryKey()])});
    content=<>{addButton('Publicar aviso')}<div className="mt-4">{failed(data.announcements)}{data.announcements.isLoading?<LoadState loading/>:(data.announcements.data?.length?<div className="grid gap-3 lg:grid-cols-2">{data.announcements.data.map((a:Announcement)=><Panel key={a.id}><div className="flex justify-between gap-3"><h2 className="font-[var(--app-font-serif)] text-lg font-bold">{a.title}</h2><span className="h-fit rounded-full bg-[#e7eee6] px-2.5 py-1 text-[10px] font-bold text-[#4d765a]">{a.audience==='all'?'Todos':a.audience}</span></div><p className="mt-3 text-sm leading-6 text-[#65736e]">{a.body}</p><div className="mt-5 flex justify-between border-t border-[#eeece3] pt-3 text-[11px] text-[#89938e]"><span>Por {a.author}</span><span>{new Date(a.createdAt).toLocaleDateString('pt-BR')}</span></div></Panel>)}</div>:<Empty title="Nenhum aviso disponível" detail="Os comunicados da escola aparecerão nesta página." />)}</div></>;
  } else if(lower==='relatorios'){
    title='Relatórios acadêmicos';description='Uma leitura consolidada de desempenho e presença.';const report=data.report.data;
    content=<>{failed(data.report)}{data.report.isLoading?<LoadState loading/>:report?<><div className="mb-4 grid gap-3 sm:grid-cols-3"><Metric label="Média geral" value={report.summary.averageGrade.toLocaleString('pt-BR')}/><Metric label="Frequência" value={`${report.summary.attendancePercent.toLocaleString('pt-BR')}%`}/><Metric label="Estudantes" value={report.summary.studentCount.toLocaleString('pt-BR')}/></div><DataTable rows={report.rows} columns={[{label:'Estudante',render:r=><strong>{r.studentName}</strong>},{label:'Média',render:r=>r.averageGrade.toLocaleString('pt-BR')},{label:'Presenças',render:r=>r.present},{label:'Encontros',render:r=>r.sessions},{label:'Frequência',render:r=>r.sessions?`${Math.round(r.present/r.sessions*100)}%`:'—'}]}/></>:<Empty title="Relatório ainda indisponível" detail="Não há dados suficientes para montar este relatório."/>}</>;
  } else if(lower==='auditoria'){
    title='Trilha de auditoria';description='Ações registradas no sistema para apoiar a transparência.';const entries=data.audit.data?.items??[];
    content=<>{failed(data.audit)}{data.audit.isLoading?<LoadState loading/>:<DataTable rows={entries} columns={[{label:'Responsável',render:a=><strong>{a.actorName}</strong>},{label:'Ação',render:a=>a.action},{label:'Entidade',render:a=><span className="rounded bg-[#f0efe7] px-2 py-1 text-xs">{a.entity}</span>},{label:'Registro',render:a=>a.entityId??'—'},{label:'Data e hora',render:a=>new Date(a.createdAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}]}/>}</>;
  } else {
    title='Meu perfil';description='Informações da sua conta EduTrack.';content=<Panel className="max-w-2xl"><div className="flex items-center gap-4 border-b border-[#ece9df] pb-5"><span className="grid h-14 w-14 place-items-center rounded-full bg-[#dcebe0] font-bold text-[#286b55]">{data.user.data?.user.name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}</span><div><h2 className="font-[var(--app-font-serif)] text-xl font-bold">{data.user.data?.user.name}</h2><p className="mt-1 text-sm text-muted-foreground">{roleName[data.user.data?.user.role as Role]}</p></div></div><div className="grid gap-4 pt-5 sm:grid-cols-2"><ProfileField label="E-mail institucional" value={data.user.data?.user.email??'—'}/><ProfileField label="Situação" value={data.user.data?.user.status==='active'?'Ativo':'Inativo'}/><ProfileField label="Identificador" value={String(data.user.data?.user.id??'—')}/><ProfileField label="Perfil de acesso" value={roleName[data.user.data?.user.role as Role]??'Usuário'}/></div></Panel>;
  }
  const canCreate=['alunos','professores','disciplinas','turmas','avaliacoes','avisos'].includes(lower);
  return <DataPage title={title} description={description} action={canCreate?addButton(lower==='avisos'?'Publicar aviso':undefined):undefined}>{content}{dialog&&<FormDialog title={lower==='alunos'?'Cadastrar aluno':lower==='professores'?'Cadastrar professor':lower==='disciplinas'?'Cadastrar disciplina':lower==='turmas'?'Criar turma':lower==='matriculas'?'Registrar matrícula':lower==='avaliacoes'?'Criar avaliação':lower==='notas'?'Registrar nota':lower==='frequencia'?'Registrar frequência':'Publicar aviso'} fields={fields} onSubmit={save} pending={pending} error={actionError} onClose={resetDialog}/>}</DataPage>;
}
function Metric({label,value}:{label:string;value:string}){return <Panel className="p-5"><p className="text-xs font-semibold text-[#77837d]">{label}</p><p className="mt-3 font-[var(--app-font-serif)] text-3xl font-bold text-[#2d6d55]">{value}</p></Panel>}
function ProfileField({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-[#f4f3eb] p-4"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#87918b]">{label}</p><p className="mt-1.5 text-sm font-semibold text-[#3c515c]">{value}</p></div>}

function ClassDetailPage() {
  const [path]=useLocation();
  const raw=path.split('/').at(-1);
  const id=Number(raw);
  const query=useGetClass(id,{query:{enabled:Number.isFinite(id)&&id>0,queryKey:getGetClassQueryKey(id)}});
  const detail=query.data;
  return <DataPage title={detail?.classroom.name??'Detalhe da turma'} description={detail?`${detail.classroom.subjectName} · ${detail.classroom.teacherName} · ${detail.classroom.term}`:'Informações da turma e estudantes vinculados.'} action={<Link href="/turmas" className="rounded-xl border border-[#deddd2] bg-card px-4 py-2.5 text-sm font-semibold text-[#53656c]">Voltar às turmas</Link>}>{query.isLoading?<LoadState loading/>:query.isError?<LoadState error onRetry={()=>query.refetch()}/>:detail?<><div className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="Estudantes" value={String(detail.classroom.studentsCount)}/><Metric label="Período" value={detail.classroom.term}/><Metric label="Disciplina" value={detail.classroom.subjectName}/></div><Panel><h2 className="mb-4 font-[var(--app-font-serif)] text-xl font-bold">Estudantes desta turma</h2><DataTable rows={detail.students} columns={[{label:'Nome',render:s=><strong>{s.name}</strong>},{label:'Matrícula',render:s=><span className="font-mono text-xs">{s.registration}</span>},{label:'E-mail',render:s=>s.email},{label:'Situação',render:s=><Status value={s.status}/>} ]}/></Panel></>:<Empty title="Turma não encontrada"/>}</DataPage>;
}
function DashboardRoute({data,session}:{data:ReturnType<typeof useWorkspaceQueries>;session:SessionData}) {return <DashboardPage data={data} session={session}/>;}
function SignedInRouter({session}:{session:SessionData}) {
  const data=useWorkspaceQueries();
  const [path]=useLocation();
  return <AppShell session={session}><Switch>
    <Route path="/dashboard"><DashboardRoute data={data} session={session}/></Route>
    <Route path="/alunos"><WorkspacePage path="/alunos" data={data}/></Route>
    <Route path="/professores"><WorkspacePage path="/professores" data={data}/></Route>
    <Route path="/disciplinas"><WorkspacePage path="/disciplinas" data={data}/></Route>
    <Route path="/turmas"><WorkspacePage path="/turmas" data={data}/></Route>
    <Route path="/turmas/:id"><ClassDetailPage/></Route>
    <Route path="/matriculas"><WorkspacePage path="/matriculas" data={data}/></Route>
    <Route path="/avaliacoes"><WorkspacePage path="/avaliacoes" data={data}/></Route>
    <Route path="/notas"><WorkspacePage path="/notas" data={data}/></Route>
    <Route path="/frequencia"><WorkspacePage path="/frequencia" data={data}/></Route>
    <Route path="/avisos"><WorkspacePage path="/avisos" data={data}/></Route>
    <Route path="/relatorios"><WorkspacePage path="/relatorios" data={data}/></Route>
    <Route path="/auditoria"><WorkspacePage path="/auditoria" data={data}/></Route>
    <Route path="/perfil"><WorkspacePage path="/perfil" data={data}/></Route>
    <Route><NotFound/></Route>
  </Switch></AppShell>;
}
function AuthGate() {
  const [path,setLocation]=useLocation();
  const current=useGetCurrentUser({query:{queryKey:getGetCurrentUserQueryKey(),retry:false}});
  if(path==='/' ) return <PublicHome/>;
  if(path==='/login') return current.data?<SignedInRouter session={current.data as SessionData}/>:<LoginPage/>;
  if(path==='/forgot-password') return <ForgotPage/>;
  if(current.isLoading) return <div className="min-h-[100dvh] bg-[#f5f3e9] p-5"><div className="mx-auto mt-20 max-w-5xl space-y-4"><div className="h-9 w-48 animate-pulse rounded-xl bg-[#e5e4d9]"/><div className="h-32 animate-pulse rounded-2xl bg-[#e5e4d9]"/><div className="h-64 animate-pulse rounded-2xl bg-[#e5e4d9]"/></div></div>;
  if(current.data) return <SignedInRouter session={current.data as SessionData}/>;
  if(current.isError && path!=='/dashboard' && path!=='/alunos' && path!=='/professores' && path!=='/disciplinas' && path!=='/turmas' && path!=='/matriculas' && path!=='/avaliacoes' && path!=='/notas' && path!=='/frequencia' && path!=='/avisos' && path!=='/relatorios' && path!=='/auditoria' && path!=='/perfil') return <NotFound/>;
  return <main className="grid min-h-[100dvh] place-items-center bg-[#f5f3e9] px-5"><div className="max-w-md rounded-[22px] border border-[#e5e1d6] bg-[#fbfaf5] p-8 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f5e9dc] text-[#a9684c]"><ShieldCheck/></span><h1 className="mt-5 font-[var(--app-font-serif)] text-2xl font-bold">Acesso ao espaço escolar</h1><p className="mt-2 text-sm leading-6 text-[#73807d]">Entre com sua conta institucional para consultar as informações acadêmicas.</p>{current.isError&&<p className="mt-3 text-xs text-[#87908c]">{errorText(current.error)}</p>}<Button onClick={()=>setLocation('/login')} className="mt-6 bg-[#236a56] hover:bg-[#1c5948]">Ir para o acesso <ArrowRight size={15} className="ml-2"/></Button><button onClick={()=>current.refetch()} className="mt-3 block w-full text-xs font-semibold text-[#57746a]">Tentar novamente</button></div></main>;
}
function App() {
  return <QueryClientProvider client={client}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/,'')}><ErrorBoundary><AuthGate/></ErrorBoundary></WouterRouter><Toaster/></TooltipProvider></QueryClientProvider>;
}
export default App;
