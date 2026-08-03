import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import WordBridgeWeeklyChallenge from './WordBridgeWeeklyChallenge';
import EventsHighlightBlock from './EventsHighlightBlock';
import AnnouncementCardBlock from './AnnouncementCardBlock';
import ColumnsBlock from './ColumnsBlock';
import EmbedBlock from './EmbedBlock';
import PollBlock from './PollBlock';
import QuizBlock from './QuizBlock';
import { youtubeEmbedUrl } from '../../constants/weeklyBlocks';
import './WeeklyBlockRenderer.css';

function SafeHtml({ html, className }) {
  if (!html) return null;
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function HeroBlock({ props }) {
  return (
    <section className="wb-hero public-card">
      {props.imageUrl ? (
        <div className="wb-hero__media">
          <img src={props.imageUrl} alt={props.imageAlt || ''} loading="lazy" />
        </div>
      ) : null}
      <div className="wb-hero__body">
        {props.kicker ? <p className="wb-hero__kicker">{props.kicker}</p> : null}
        {props.title ? <h2 className="wb-hero__title">{props.title}</h2> : null}
        {props.subtitle ? <p className="wb-hero__subtitle">{props.subtitle}</p> : null}
      </div>
    </section>
  );
}

function ImageBlock({ props }) {
  if (!props.url) return null;
  return (
    <figure className={`wb-image wb-image--${props.width || 'full'} public-card`}>
      <img src={props.url} alt={props.alt || ''} loading="lazy" />
      {props.caption ? <figcaption>{props.caption}</figcaption> : null}
    </figure>
  );
}

function GalleryBlock({ props }) {
  const items = Array.isArray(props.items) ? props.items : [];
  if (!items.length) return null;
  return (
    <div className="wb-gallery public-card">
      <div className="wb-gallery__grid">
        {items.map((item) => (
          <figure key={item.url} className="wb-gallery__item">
            <img src={item.url} alt={item.alt || ''} loading="lazy" />
            {item.caption ? <figcaption>{item.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
    </div>
  );
}

function AudioBlock({ props }) {
  if (!props.url) return null;
  return (
    <div className="wb-audio public-card">
      {props.title ? <p className="wb-media__title">{props.title}</p> : null}
      <audio controls preload="metadata" src={props.url} className="wb-audio__player">
        <track kind="captions" />
      </audio>
      {props.caption ? <p className="wb-media__caption">{props.caption}</p> : null}
    </div>
  );
}

function VideoBlock({ props }) {
  if (!props.url) return null;
  const embed = props.provider === 'youtube' ? youtubeEmbedUrl(props.url) : '';
  return (
    <div className="wb-video public-card">
      {props.title ? <p className="wb-media__title">{props.title}</p> : null}
      {embed ? (
        <div className="wb-video__embed">
          <iframe
            title={props.title || 'video'}
            src={embed}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <video controls preload="metadata" src={props.url} className="wb-video__player" />
      )}
      {props.caption ? <p className="wb-media__caption">{props.caption}</p> : null}
    </div>
  );
}

function CalloutBlock({ props }) {
  if (!props.body && !props.title) return null;
  return (
    <aside className={`wb-callout wb-callout--${props.variant || 'info'} public-card`}>
      {props.title ? <p className="wb-callout__title">{props.title}</p> : null}
      {props.body ? <p className="wb-callout__body">{props.body}</p> : null}
    </aside>
  );
}

function CtaBlock({ props }) {
  const href = props.href || '/events';
  const isExternal = /^https?:\/\//i.test(href);
  const className = `btn ${props.variant === 'outline' ? 'btn-outline-primary' : 'btn-primary'} wb-cta`;
  if (isExternal) {
    return (
      <div className="wb-cta-wrap">
        <a href={href} className={className} target="_blank" rel="noreferrer">
          {props.label || '了解更多'}
        </a>
      </div>
    );
  }
  return (
    <div className="wb-cta-wrap">
      <Link to={href} className={className}>{props.label || '了解更多'}</Link>
    </div>
  );
}

function QuoteBlock({ props }) {
  if (!props.text) return null;
  return (
    <blockquote className="wb-quote public-card">
      <p className="wb-quote__text">{props.text}</p>
      {props.attribution ? <footer className="wb-quote__attr">— {props.attribution}</footer> : null}
    </blockquote>
  );
}

function DividerBlock({ props }) {
  const style = props.style || 'line';
  return <hr className={`wb-divider wb-divider--${style}`} aria-hidden="true" />;
}

function ChallengeBlock({ props, t, block, weeklySlug, issueKey }) {
  return (
    <section className="public-card wb-challenge">
      <h2 className="wb-section-title">{t('weekly.challengeTitle')}</h2>
      <WordBridgeWeeklyChallenge
        level={props.level}
        themeIds={props.themeIds}
        blockId={block?.id}
        weeklySlug={weeklySlug}
        issueKey={issueKey}
      />
    </section>
  );
}

function SpacerBlock({ props }) {
  return <div className={`wb-spacer wb-spacer--${props.size || 'md'}`} aria-hidden="true" />;
}

const RENDERERS = {
  hero: HeroBlock,
  richText: ({ props }) => <SafeHtml html={props.html} className="wb-richtext public-card" />,
  image: ImageBlock,
  gallery: GalleryBlock,
  audio: AudioBlock,
  video: VideoBlock,
  callout: CalloutBlock,
  quote: QuoteBlock,
  divider: DividerBlock,
  eventsHighlight: EventsHighlightBlock,
  announcementCard: AnnouncementCardBlock,
  columns: ColumnsBlock,
  embed: EmbedBlock,
  poll: PollBlock,
  quiz: QuizBlock,
  cta: CtaBlock,
  wordBridgeChallenge: ChallengeBlock,
  spacer: SpacerBlock,
};

export default function WeeklyBlockRenderer({
  blocks = [],
  mode = 'page',
  weeklySlug = '',
  issueKey = '',
}) {
  const { t } = useLanguage();
  if (!blocks.length) return null;

  return (
    <div className={`weekly-blocks weekly-blocks--${mode}`}>
      {blocks.map((block) => {
        const Component = RENDERERS[block.type];
        if (!Component) return null;
        return (
          <div key={block.id} className="weekly-blocks__item" data-block-type={block.type}>
            <Component
              props={block.props || {}}
              t={t}
              block={block}
              blockId={block.id}
              slug={weeklySlug}
              weeklySlug={weeklySlug}
              issueKey={issueKey}
            />
          </div>
        );
      })}
    </div>
  );
}
