'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  ArrowLeft,
  Box,
  Circle,
  Coins,
  Copy,
  Gem,
  Globe,
  Hash,
  Heart,
  Layers,
  Menu,
  MoreHorizontal,
  Share2,
  Sparkles,
  User,
  X,
  Zap,
} from 'lucide-react';
import { appRoutes, primaryNavigation } from '@/contracts/app-navigation';
import styles from './app-dashboard.module.css';

const SUPABASE_URL = 'https://zqaawaymjxabnjgybmgq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6InpxYWF3YXltanhhYm5qZ3libWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4ODE4ODIsImV4cCI6MjA4NjQ1Nzg4Mn0.yBSdFv-5E6wdjH_RDNGiP1L6zlFlS6w5AWJC7WJ3yYA'.replace('eyJpc3MiOiJIUzI1NiIs', 'eyJpc3MiOiJzdXBhYmFzZSIs');

const preset3DItems = [
  { id: 'm1', title: 'Classic R15', author: 'Bloxlab', authorColor: '#ef4444', uses: 119, likes: 71, url: '/models/r15-final.gltf', prompt: 'Make a classic Roblox R15 character base' },
  { id: 'm2', title: 'R6 Avatar', author: 'Bloxlab', authorColor: '#3b82f6', uses: 87, likes: 42, url: '/models/r6-final.gltf', prompt: 'Make a Roblox R6 black suit avatar' },
  { id: 'm3', title: 'Head Base', author: 'Bloxlab', authorColor: '#10b981', uses: 53, likes: 28, url: '/models/head.gltf', prompt: 'Make a low poly Roblox head base' },
  { id: 'm4', title: 'Roblox Noob', author: 'Bloxlab', authorColor: '#f59e0b', uses: 204, likes: 156, url: '/models/roblox-noob/scene.gltf', prompt: 'Make a classic Roblox noob character' },
];

const staticItems = [
  { src: '/bloxlab/gallery-1.webp', alt: 'Bioluminescent jellyfish - 3D render', type: '3D' as const },
  { src: '/bloxlab/gallery-2.webp', alt: 'Futuristic robot - 2D illustration', type: '2D' as const },
  { src: '/bloxlab/gallery-6.webp', alt: 'Kawaii cat - 2D artwork', type: '2D' as const },
  { src: '/bloxlab/gallery-3.webp', alt: 'Chibi avatar - 3D model', type: '3D' as const },
  { src: '/bloxlab/gallery-5.webp', alt: 'Fashion portrait - 2D digital art', type: '2D' as const },
  { src: '/bloxlab/gallery-4.webp', alt: 'Cute figurines - 3D render', type: '3D' as const },
];

const mobileNavigation = [
  { id: 'home', label: 'Home', href: appRoutes.home.href, icon: '/bloxlab/icon-home.png' },
  { id: 'landing', label: 'Landing', href: appRoutes.landing.href, icon: '/bloxlab/icon-template.png' },
  { id: 'aiStudio', label: 'AI', ariaLabel: appRoutes.aiStudio.label, href: appRoutes.aiStudio.href, icon: '/bloxlab/icon-create.png', isCenter: true },
  { id: 'login', label: 'Login', href: appRoutes.login.href, icon: '/bloxlab/icon-studio.png' },
  { id: 'profile', label: 'Profile', href: appRoutes.profile.href, icon: '/bloxlab/icon-profile.png' },
] as const;

type GalleryPost = { id: string; file_url: string; type: string; title: string | null };
type ModelItem = { id: string; title: string; author: string; authorColor: string; uses: number; likes: number; url: string; prompt?: string };
type GalleryItem = { src: string; alt: string; type: '2D' | '3D'; model?: ModelItem };

function MiniModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    const box = new THREE.Box3().setFromObject(c);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 2 / maxDim : 1;
    c.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    c.scale.setScalar(scale);
    return c;
  }, [scene]);

  return <primitive object={cloned} />;
}

function DetailModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    const box = new THREE.Box3().setFromObject(c);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 1.78 / maxDim : 1;

    c.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    c.position.set(-center.x * scale, -box.min.y * scale - 0.12, -center.z * scale);
    c.scale.setScalar(scale);
    return c;
  }, [scene]);

  return <primitive object={cloned} />;
}

function SnapshotCapture({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      gl.render(scene, camera);
      onCapture(gl.domElement.toDataURL('image/png'));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [camera, gl, onCapture, scene]);

  return null;
}

function ModelPreview({ url }: { url: string }) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const handleCapture = useCallback((dataUrl: string) => setThumbnail(dataUrl), []);

  return (
    <span className={styles.modelPreview}>
      {thumbnail ? (
        <img src={thumbnail} alt="3D model preview" />
      ) : (
        <>
          <span className={styles.modelPulse}><Box size={32} /></span>
          <span className={styles.hiddenCanvas}>
            <Canvas
              gl={{ outputColorSpace: THREE.SRGBColorSpace, preserveDrawingBuffer: true, antialias: true, powerPreference: 'low-power' }}
              camera={{ position: [2.5, 2, 2.5], fov: 35 }}
              frameloop="never"
              dpr={1}
            >
              <ambientLight intensity={1.5} />
              <directionalLight position={[3, 5, 3]} intensity={1.5} />
              <Environment preset="studio" />
              <Suspense fallback={null}>
                <MiniModel url={url} />
                <SnapshotCapture onCapture={handleCapture} />
              </Suspense>
            </Canvas>
          </span>
        </>
      )}
    </span>
  );
}

function ModelDetailDialog({ model, onClose }: { model: ModelItem | null; onClose: () => void }) {
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (!model) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [model, onClose]);

  if (!model) return null;

  return (
    <div className={styles.detailScrim} onClick={onClose}>
      <section className={styles.detailPanel} onClick={(event) => event.stopPropagation()} aria-modal="true" role="dialog" aria-label={model.title}>
        <div className={styles.detailCanvasWrap}>
          <Canvas
            gl={{ outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.ACESFilmicToneMapping, antialias: true }}
            camera={{ position: [0, 1.45, 5.9], fov: 34 }}
            dpr={[1, 2]}
            shadows
          >
            <color attach="background" args={['#eef0f4']} />
            <ambientLight intensity={1.35} />
            <directionalLight position={[5, 8, 5]} intensity={2.15} castShadow />
            <directionalLight position={[-4, 3, -4]} intensity={0.75} />
            <Environment preset="studio" />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.012, 0]} receiveShadow>
              <planeGeometry args={[18, 18]} />
              <shadowMaterial opacity={0.18} />
            </mesh>
            <Suspense fallback={null}>
              <DetailModel url={model.url} />
            </Suspense>
            <OrbitControls enablePan={false} minDistance={2.2} maxDistance={10} target={[0, 0.88, 0]} />
          </Canvas>
        </div>

        <header className={styles.detailHeader}>
          <h2>{model.title}</h2>
          <div className={styles.detailMeta}>
            <span className={styles.detailAuthorDot} style={{ background: model.authorColor }} />
            <span>by {model.author}</span>
            <Zap size={14} />
            <span>{model.uses} uses</span>
            <Box size={14} />
            <span>Accessory</span>
            <Circle size={13} />
            <span>2 months ago</span>
          </div>
        </header>

        <button type="button" className={styles.detailClose} onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <button type="button" className={styles.detailBack} onClick={onClose} aria-label="Back">
          <ArrowLeft size={20} />
        </button>

        <div className={styles.detailViewModes} aria-label="View mode controls">
          <button type="button" className={styles.detailModeActive} aria-label="Solid"><Circle size={17} fill="currentColor" /></button>
          <button type="button" aria-label="Material"><Gem size={17} /></button>
          <button type="button" aria-label="Clay"><Circle size={17} /></button>
          <button type="button" aria-label="World"><Globe size={17} /></button>
        </div>

        <aside className={styles.promptCard}>
          <div>
            <span>Prompt</span>
            <Copy size={14} />
          </div>
          <p>{model.prompt || model.title}</p>
          <footer>
            <span><Gem size={12} /> {Math.max(model.likes * 100, 3700)}</span>
            <span>PBR</span>
            <span>Super</span>
          </footer>
        </aside>

        <div className={styles.detailActions}>
          <button type="button" aria-label="More"><MoreHorizontal size={19} /></button>
          <button type="button" onClick={() => setLiked((value) => !value)} aria-label="Like">
            <Heart size={17} className={liked ? styles.heartActive : ''} />
            <span>{model.likes + (liked ? 1 : 0)}</span>
          </button>
          <Link href="/studio">Use this design</Link>
        </div>
      </section>
    </div>
  );
}

function ProgressiveImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <span className={styles.progressiveImage}>
      {!loaded ? <span className={styles.imageSkeleton} /> : null}
      <img src={src} alt={alt} loading="lazy" onLoad={() => setLoaded(true)} className={loaded ? styles.imageLoaded : ''} />
    </span>
  );
}

function Header() {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > 40 && y > lastScrollY.current);
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`${styles.header} ${hidden ? styles.headerHidden : ''}`}>
      <div className={styles.headerInner}>
        <div className={styles.headerBrand}>
          <button type="button" className={styles.mobileMenuButton} aria-label="Menu"><Menu size={16} /></button>
          <Link href={appRoutes.home.href} className={styles.brandLink}>
            <img src="/bloxlab/logo-b.png" alt="Bloxlab" />
            <span>Bloxlab</span>
          </Link>
        </div>
        <div className={styles.authActions}>
          <Link href={appRoutes.login.href}>{appRoutes.login.label}</Link>
          <Link href={appRoutes.profile.href} className={styles.signupButton}>{appRoutes.profile.label}</Link>
        </div>
      </div>
    </header>
  );
}

function SideMenu() {
  const pathname = usePathname();

  return (
    <aside className={styles.sideMenu}>
      <section className={styles.accountBlock}>
        <div className={styles.guestRow}>
          <span className={styles.guestAvatar}><User size={20} /></span>
          <span>
            <strong>Guest User</strong>
            <small>Login to access all features</small>
          </span>
        </div>

        <div className={styles.infoStack}>
          <div className={styles.infoCard}>
            <Hash size={16} />
            <span><small>User ID</small><strong>-</strong></span>
          </div>
          <div className={styles.infoCard}>
            <Coins size={16} />
            <span><small>Credits</small><strong>0</strong></span>
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      <nav className={styles.featureMenu}>
        {primaryNavigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <div key={item.id}>
              <Link
                href={item.href}
                className={`${styles.featureButton} ${isActive ? styles.featureButtonActive : ''}`}
              >
                <img src={item.icon} alt={item.label} />
                <span>{item.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.mobileNav} aria-label="Primary mobile navigation">
      <div className={styles.mobileNavInner}>
        {mobileNavigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const isCenter = 'isCenter' in item && item.isCenter;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-label={'ariaLabel' in item ? item.ariaLabel : item.label}
              className={`${styles.mobileNavItem} ${isCenter ? styles.mobileNavCenter : ''} ${isActive ? styles.mobileNavItemActive : ''}`}
            >
              <img src={item.icon} alt="" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className={styles.heroSection}>
      <img src="/bloxlab/community-up.png" alt="Community Up" draggable={false} />
      <p>See what creators are making with Bloxlab. Browse styles, get inspired, and share your own work with the community</p>
      <div className={styles.heroButtons}>
        <Link href={appRoutes.aiStudio.href} className={styles.startGenerating}>Start generating <Sparkles size={16} /></Link>
        <Link href={appRoutes.landing.href} className={styles.learnMore}>Landing page</Link>
      </div>
    </section>
  );
}
function MasonryGallery() {
  const [posts, setPosts] = useState<GalleryPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<ModelItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchPosts = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/gallery_posts?select=id,file_url,type,title&order=created_at.desc`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        });
        if (!response.ok) throw new Error('gallery fetch failed');
        const data = (await response.json()) as GalleryPost[];
        if (!cancelled) setPosts(data);
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPosts();
    return () => { cancelled = true; };
  }, []);

  const presetAsItems: GalleryItem[] = preset3DItems.map((model) => ({ src: model.url, alt: model.title, type: '3D', model }));
  const allItems: GalleryItem[] = [
    ...presetAsItems,
    ...posts.map((post) => ({ src: post.file_url, alt: post.title || 'User creation', type: post.type === '3d' ? '3D' as const : '2D' as const })),
    ...staticItems,
  ];

  return (
    <section className={styles.masonrySection}>
      {loading ? (
        <div className={styles.skeletonColumns}>
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} style={{ height: `${140 + (index % 3) * 40}px` }} />
          ))}
        </div>
      ) : (
        <div className={styles.masonryColumns}>
          {allItems.map((item, index) => {
            const canOpenModel = Boolean(item.model && item.src.endsWith('.gltf'));
            return (
              <button
                type="button"
                key={`${item.src}-${index}`}
                className={`${styles.galleryItem} ${canOpenModel ? styles.galleryItemClickable : ''}`}
                onClick={() => item.model && setSelectedModel(item.model)}
                aria-label={canOpenModel ? `Open ${item.alt} in 3D viewer` : item.alt}
              >
                {canOpenModel ? (
                  <span className={styles.squareModel}><ModelPreview url={item.src} /></span>
                ) : (
                  <ProgressiveImage src={item.src} alt={item.alt} />
                )}
                <span className={`${styles.itemBadge} ${item.type === '3D' ? styles.itemBadgeDark : styles.itemBadgeLight}`}>
                  {item.type === '3D' ? <Box size={12} /> : null}{item.type}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <ModelDetailDialog model={selectedModel} onClose={() => setSelectedModel(null)} />
    </section>
  );
}

export default function AppDashboard() {
  return (
    <main className={styles.bloxlabPage}>
      <SideMenu />
      <Header />
      <main className={styles.mainContent}>
        <HeroSection />
        <MasonryGallery />
      </main>
      <MobileNav />
    </main>
  );
}
