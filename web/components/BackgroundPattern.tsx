import {
  Activity,
  BarChart,
  Binary,
  Braces,
  Brackets,
  Bug,
  Cloud,
  Code,
  Code2,
  CommandIcon,
  Cpu,
  CpuIcon,
  Database,
  Download,
  FileCode,
  Filter,
  Folder,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Globe,
  HardDrive,
  Hash,
  Headphones,
  Key,
  Layers,
  Layout,
  Lock,
  Monitor,
  Network,
  Package,
  Palette,
  Pause,
  Play,
  Rocket,
  Search,
  Server,
  Settings,
  Shield,
  SkipBack,
  SkipForward,
  Smartphone,
  StopCircle,
  Target,
  Terminal,
  TerminalSquare,
  Upload,
  Variable,
  Volume2,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-preact'

const allIcons = [
  Activity,
  BarChart,
  Bug,
  Cloud,
  Code,
  Cpu,
  Database,
  GitBranch,
  GitCommit,
  GitPullRequest,
  HardDrive,
  Key,
  Layout,
  Lock,
  Monitor,
  Network,
  Palette,
  Server,
  Shield,
  Smartphone,
  Terminal,
  Wifi,
  Zap,
  Code2,
  TerminalSquare,
  CpuIcon,
  Wrench,
  Settings,
  Package,
  Folder,
  FileCode,
  Globe,
  Layers,
  CommandIcon,
  Brackets,
  Binary,
  Hash,
  Braces,
  Variable,
  Search,
  Filter,
  Target,
  Rocket,
  Download,
  Upload,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  Headphones,
  StopCircle,
]

const techTerms = [
  'REACT',
  'NODE',
  'DOCKER',
  'AWS',
  'REDIS',
  'CSS',
  'HTTP',
  'OAUTH',
  'SSL',
  'NGINX',
  'NPM',
  'WEBPACK',
  'JSON',
  'SQL',
  'BASH',
  'JWT',
  'API',
  'TS',
  'JS',
  'HTML',
  'REST',
  'GRAPHQL',
  'GIT',
  'CI/CD',
  'K8S',
  'PYTHON',
  'GO',
  'RUST',
  'JAVA',
  'PHP',
]

const randomInRange = (min: number, max: number) =>
  Math.random() * (max - min) + min
const randomInt = (min: number, max: number) =>
  Math.floor(randomInRange(min, max + 1))
const randomItem = <T,>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]
const randomBool = () => Math.random() > 0.5

export const BackgroundPattern = () => {
  const gridElements = Array.from({ length: 35 }).map((_) => {
    const useIcon = randomBool()
    const row = randomInt(1, 7)
    const col = randomInt(1, 10)
    const size = randomInRange(4, 8)
    const opacity = randomInRange(30, 70)
    const rotation = randomInRange(-15, 15)

    return {
      type: useIcon ? 'icon' : 'text',
      component: useIcon ? randomItem(allIcons) : undefined,
      content: useIcon ? undefined : randomItem(techTerms),
      row,
      col,
      size,
      opacity,
      rotation,
    }
  })

  const borderElements = Array.from({ length: 30 }).map((_) => {
    const position = randomItem(['top', 'right', 'bottom', 'left'])
    let top = '', left = '', right = ''
    const size = randomInRange(3, 6)
    const opacity = randomInRange(20, 50)
    const rotation = randomInRange(-20, 20)

    switch (position) {
      case 'top':
        top = `${randomInRange(1, 5)}%`
        left = `${randomInRange(5, 95)}%`
        break
      case 'right':
        top = `${randomInRange(5, 95)}%`
        right = `${randomInRange(1, 5)}%`
        break
      case 'bottom':
        top = `${randomInRange(95, 99)}%`
        left = `${randomInRange(5, 95)}%`
        break
      case 'left':
        top = `${randomInRange(5, 95)}%`
        left = `${randomInRange(1, 5)}%`
        break
    }

    return {
      component: randomItem(allIcons),
      top,
      left,
      right,
      size,
      opacity,
      rotation,
    }
  })

  const floatingElements = Array.from({ length: 15 }).map((_) => ({
    component: randomItem(allIcons),
    top: `${randomInRange(5, 95)}%`,
    left: `${randomInRange(5, 95)}%`,
    size: randomInRange(3, 6),
    opacity: randomInRange(20, 50),
    rotation: randomInRange(-15, 15),
  }))

  const bands = Array.from({ length: randomInt(2, 4) }).map((_) => {
    const top = `${randomInRange(15, 85)}%`
    const angle = randomInRange(-20, 20)
    const itemCount = randomInt(3, 8)

    return {
      top,
      angle,
      items: Array.from({ length: itemCount }).map(() => ({
        icon: randomItem(allIcons),
        text: randomItem(techTerms),
        size: randomInRange(3, 5),
        opacity: randomInRange(30, 60),
      })),
    }
  })

  const getGridPosition = (row: number, col: number) => {
    const gridWidth = 90
    const gridHeight = 80
    const cols = 12
    const rows = 8

    return {
      top: `${10 + (row - 1) * (gridHeight / rows) + randomInRange(-2, 2)}%`,
      left: `${5 + (col - 1) * (gridWidth / cols) + randomInRange(-2, 2)}%`,
    }
  }

  return (
    <div class='fixed inset-0 overflow-hidden pointer-events-none z-0'>
      <div
        class='absolute inset-0 opacity-10'
        style={{
          background: `linear-gradient(${randomInRange(0, 360)}deg,
                hsl(${randomInRange(200, 220)}, ${randomInRange(30, 50)}%, ${
            randomInRange(70, 90)
          }%)
                0%,
                hsl(${randomInRange(210, 230)}, ${randomInRange(40, 60)}%, ${
            randomInRange(80, 95)
          }%)
                100%)`,
        }}
      />

      {gridElements.map((el, i) => {
        const position = getGridPosition(el.row, el.col)
        return (
          <div
            key={`grid-${i}`}
            class='absolute flex items-center justify-center'
            style={{
              top: position.top,
              left: position.left,
              opacity: `${el.opacity}%`,
              transform: `rotate(${el.rotation}deg)`,
            }}
          >
            {el.type === 'icon' && el.component
              ? <el.component size={el.size} class='text-primary' />
              : (
                <div
                  class={`text-primary font-medium tracking-wide`}
                  style={{ fontSize: `${el.size * 0.2}rem` }}
                >
                  {el.content}
                </div>
              )}
          </div>
        )
      })}

      {borderElements.map((el, i) => (
        <div
          key={`border-${i}`}
          class='absolute'
          style={{
            top: el.top,
            left: el.left,
            right: el.right,
            opacity: `${el.opacity}%`,
            transform: `rotate(${el.rotation}deg)`,
          }}
        >
          <el.component size={el.size} class='text-primary' />
        </div>
      ))}

      {floatingElements.map((el, i) => (
        <div
          key={`float-${i}`}
          class='absolute'
          style={{
            top: el.top,
            left: el.left,
            opacity: `${el.opacity}%`,
            transform: `rotate(${el.rotation}deg)`,
            fontSize: `${el.size * 0.2}rem`,
          }}
        >
          <el.component class='text-primary' />
        </div>
      ))}

      {bands.map((band, i) => (
        <div
          key={`band-${i}`}
          class='absolute w-[250%] left-[-75%] flex items-center justify-around gap-12'
          style={{
            top: band.top,
            transform: `rotate(${band.angle}deg) translateY(-50%)`,
          }}
        >
          {band.items.map((item, j) => (
            <div
              key={`band-item-${i}-${j}`}
              class='flex items-center gap-6'
              style={{
                opacity: `${item.opacity}%`,
              }}
            >
              <item.icon
                class='text-primary'
                style={{
                  width: `${item.size * 0.2}rem`,
                  height: `${item.size * 0.2}rem`,
                }}
              />
              <span
                class='text-primary font-medium tracking-wider'
                style={{ fontSize: `${randomInRange(0.7, 1.1)}rem` }}
              >
                {item.text}
              </span>
            </div>
          ))}
        </div>
      ))}

      {['top', 'right', 'bottom', 'left'].map((position) => (
        <div
          key={position}
          class={`absolute text-xs text-primary opacity-25 font-mono`}
          style={{
            [position]: '1rem',
            transform: `rotate(${randomInRange(-5, 5)}deg)`,
            ...(position === 'top' || position === 'bottom'
              ? { left: `${randomInRange(5, 95)}%` }
              : { top: `${randomInRange(5, 95)}%` }),
          }}
        >
          {randomItem([
            'DEV',
            'CODE',
            'BUILD',
            'RUN',
            'DEBUG',
            'DEPLOY',
            'TEST',
          ])}
        </div>
      ))}
    </div>
  )
}
