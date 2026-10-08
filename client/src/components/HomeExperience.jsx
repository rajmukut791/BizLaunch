import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Store,
  Package,
  BarChart3,
  Truck,
  Pause,
  Play,
  Sparkles,
} from 'lucide-react';
import './HomeExperience.css';

export function HomeHero({ total }) {
  const stage = useRef(null),
    frame = useRef(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const scene = stage.current;
    const observer = new IntersectionObserver(
      ([entry]) => scene?.setAttribute('data-visible', String(entry.isIntersecting)),
      { threshold: 0.05 },
    );
    if (scene) observer.observe(scene);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, []);
  const reset = () => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    stage.current?.style.setProperty('--turn-x', '-10deg');
    stage.current?.style.setProperty('--turn-y', '-22deg');
  };
  const move = (event) => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      stage.current?.style.setProperty('--turn-x', -10 - y * 12 + 'deg');
      stage.current?.style.setProperty('--turn-y', -22 + x * 28 + 'deg');
    });
  };
  return (
    <section className="home-hero container">
      <div className="home-hero-copy">
        <div className="home-eyebrow">
          <span /> A LITTLE INDEPENDENT. A LOT OF POSSIBILITY.
        </div>
        <h1>
          Discover <br />
          good things. <br />
          <span>
            Launch great
            <br className="hero-title-break" /> things.
          </span>
        </h1>
        <p>
          A home for the brands with a story.
          <br className="home-desktop-break" /> A starting point for the business in you.
        </p>
        <div className="home-hero-actions">
          <Link className="button primary" to="/marketplace">
            Find your next favorite <ArrowUpRight size={19} />
          </Link>
          <Link className="home-secondary" to="/register">
            Build your business <ArrowRight size={18} />
          </Link>
        </div>
        <div className="home-hero-bottom">
          <span className="home-proof-icon">
            <ShieldCheck size={21} />
          </span>
          <div>
            <strong>Good people. Thoughtful products.</strong>
            <span>Verified local businesses · Cash on delivery</span>
          </div>
        </div>
        <a className="home-scroll" href="#discover">
          <span>SCROLL TO DISCOVER</span>
          <span>↓</span>
        </a>
      </div>
      <div className="home-scene-wrap">
        <div
          className="home-scene"
          ref={stage}
          data-paused={paused}
          onPointerMove={move}
          onPointerLeave={reset}
        >
          <div className="scene-topline">
            <span>
              <Sparkles size={13} /> MADE FOR YOUR NEXT CHAPTER
            </span>
            <span>01 / BIZLAUNCH</span>
          </div>
          <div className="scene-world" aria-hidden="true">
            <div className="scene-halo" />
            <div className="scene-orbit scene-orbit-one" />
            <div className="scene-orbit scene-orbit-two" />
            <div className="scene-platform" />
            <div className="scene-float">
              <div className="scene-turntable">
                <div className="store-model">
                  <div className="store-face store-right">
                    <span>
                      GOOD
                      <br />
                      THINGS
                      <br />
                      START
                      <br />
                      HERE.
                    </span>
                    <i />
                  </div>
                  <div className="store-face store-left" />
                  <div className="store-roof" />
                  <div className="store-face store-front">
                    <div className="store-sign">
                      <span>INDEPENDENT & INSPIRED</span>
                      <strong>
                        The little studio<span>✳</span>
                      </strong>
                    </div>
                    <div className="store-awning" />
                    <div className="store-interior">
                      <div className="store-window">
                        <img src="/home-scene/bag.svg" alt="" />
                        <div className="store-shelf" />
                      </div>
                      <div className="store-door">
                        <span>OPEN</span>
                        <i />
                      </div>
                    </div>
                    <div className="store-step" />
                  </div>
                </div>
                <div className="parcel-model">
                  <div className="parcel-front">
                    <span>
                      BIZ
                      <br />
                      LAUNCH ↗
                    </span>
                  </div>
                  <div className="parcel-side" />
                  <div className="parcel-top" />
                </div>
              </div>
            </div>
            <div className="scene-product scene-product-one">
              <span>EVERYDAY, REIMAGINED</span>
              <img src="/home-scene/headphones.svg" alt="" />
            </div>
            <div className="scene-product scene-product-two">
              <img src="/home-scene/plant.svg" alt="" />
              <span>A LITTLE MORE LIFE.</span>
            </div>
            <div className="scene-spark scene-spark-one">✳</div>
            <div className="scene-spark scene-spark-two">✦</div>
            <div className="scene-bottom-note">
              <span className="scene-note-icon">
                <Store size={18} />
              </span>
              <div>
                <strong>Small beginnings. Beautiful possibilities.</strong>
                <span>Your brand belongs here.</span>
              </div>
            </div>
          </div>
          <div className="scene-caption">
            <span>AN IDEA. A STOREFRONT. A NEW CHAPTER.</span>
            <button
              type="button"
              aria-label={paused ? 'Play homepage animation' : 'Pause homepage animation'}
              aria-pressed={paused}
              onClick={() => {
                reset();
                setPaused(!paused);
              }}
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
          </div>
        </div>
        <div className="scene-under">
          <span>Thoughtfully made for independent brands.</span>
          <strong>
            {Number.isInteger(total) ? total + ' finds to explore' : 'Find your kind of good'}{' '}
            <ArrowUpRight size={14} />
          </strong>
        </div>
      </div>
    </section>
  );
}
export function HomePromise() {
  return (
    <section className="home-promise container" aria-label="The BizLaunch experience">
      {[
        {
          icon: ShieldCheck,
          title: 'Real brands. Real care.',
          text: 'Discover businesses reviewed by our team.',
        },
        {
          icon: Truck,
          title: 'A simpler way to shop.',
          text: 'Choose your favorites. Pay on delivery.',
        },
        {
          icon: Store,
          title: 'An idea worth building.',
          text: 'Your business tools, in one thoughtful space.',
        },
      ].map(({ icon: Icon, title, text }) => (
        <div key={title}>
          <Icon size={24} strokeWidth={1.5} />
          <div>
            <strong>{title}</strong>
            <span>{text}</span>
          </div>
        </div>
      ))}
    </section>
  );
}
export function HomeSellerStory() {
  return (
    <section className="home-seller container">
      <div className="home-seller-intro">
        <span className="home-eyebrow">FOR THE MAKERS & THE DOERS</span>
        <h2>
          That idea of yours?
          <br />
          <span>Give it room to grow.</span>
        </h2>
        <p>
          From your first product to your next milestone, keep your business beautifully together.
        </p>
        <Link className="button primary" to="/register">
          Let’s build your business <ArrowUpRight size={18} />
        </Link>
      </div>
      <div className="home-bento">
        <div className="home-bento-store">
          <span className="home-bento-icon">
            <Store />
          </span>
          <span className="home-bento-label">YOUR OWN CORNER OF THE INTERNET</span>
          <h3>
            A storefront
            <br />
            with your name on it.
          </h3>
          <div className="mini-browser" aria-hidden="true">
            <div>
              <i />
              <i />
              <i />
              <span>your-brand / storefront</span>
            </div>
            <strong>
              A little collection.
              <br />A lot of you.
            </strong>
            <div className="mini-products">
              <img loading="lazy" src="/home-scene/bag.svg" alt="" />
              <img loading="lazy" src="/home-scene/plant.svg" alt="" />
              <img loading="lazy" src="/home-scene/headphones.svg" alt="" />
            </div>
          </div>
        </div>
        <div className="home-bento-operations">
          <Package size={25} />
          <h3>
            Less juggling.
            <br />
            More creating.
          </h3>
          <p>Products, variants, inventory and orders. One place to keep everything moving.</p>
          <div className="home-tags">
            <span>Products</span>
            <span>Orders</span>
            <span>Inventory</span>
          </div>
        </div>
        <div className="home-bento-insights">
          <BarChart3 size={25} />
          <h3>
            Know your business.
            <br />
            Find your next move.
          </h3>
          <p>Expenses, revenue and profit insights that help you see the bigger picture.</p>
          <div className="insight-bars" aria-hidden="true">
            {[30, 48, 38, 64, 53, 76, 88].map((height, index) => (
              <i
                key={index}
                style={{ '--bar-height': height + '%', '--bar-delay': index * 0.08 + 's' }}
              />
            ))}
          </div>
          <span className="insight-caption">ILLUSTRATIVE BUSINESS OVERVIEW</span>
        </div>
      </div>
    </section>
  );
}
