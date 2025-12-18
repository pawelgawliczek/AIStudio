import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowsPointingOutIcon,
  ArrowDownTrayIcon,
  PhotoIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import React, { useState, Fragment } from 'react';

export type ScreenshotCategory = 'before' | 'after' | 'feature' | 'bugfix' | 'ui' | 'database';

interface Screenshot {
  id: string;
  url: string;
  thumbnailUrl?: string;
  category: ScreenshotCategory;
  description?: string;
  uploadedBy?: string;
  uploadedAt: string;
  width?: number;
  height?: number;
}

interface ScreenshotGalleryProps {
  screenshots: Screenshot[];
  onUpload?: (files: FileList) => void;
  compareMode?: boolean;
}

const CATEGORY_CONFIG: Record<ScreenshotCategory, { icon: string; label: string; color: string }> = {
  before: { icon: '\uD83D\uDCF8', label: 'Before', color: 'bg-gray-500/10 text-gray-600 border-gray-500/20' },
  after: { icon: '\u2728', label: 'After', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  feature: { icon: '\u2728', label: 'Feature', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  bugfix: { icon: '\uD83D\uDC1B', label: 'Bug Fix', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  ui: { icon: '\uD83C\uDFA8', label: 'UI', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  database: { icon: '\uD83D\uDCCA', label: 'Database', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
};

function ImageViewer({
  screenshots,
  currentIndex,
  onClose,
  onNavigate,
}: {
  screenshots: Screenshot[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const [zoom, setZoom] = useState(100);
  const current = screenshots[currentIndex];

  const handlePrev = () => {
    if (currentIndex > 0) onNavigate(currentIndex - 1);
  };

  const handleNext = () => {
    if (currentIndex < screenshots.length - 1) onNavigate(currentIndex + 1);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = current.url;
    link.download = `screenshot-${current.id}.png`;
    link.click();
  };

  return (
    <Transition appear show as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/90" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-5xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={clsx(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border',
                        CATEGORY_CONFIG[current.category].color
                      )}
                    >
                      {CATEGORY_CONFIG[current.category].icon}{' '}
                      {CATEGORY_CONFIG[current.category].label}
                    </span>
                    {current.description && (
                      <span className="text-white/70 text-sm">{current.description}</span>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Image */}
                <div className="relative bg-black/50 rounded-lg overflow-hidden flex items-center justify-center min-h-[60vh]">
                  <img
                    src={current.url}
                    alt={current.description || 'Screenshot'}
                    className="max-w-full max-h-[70vh] object-contain"
                    style={{ transform: `scale(${zoom / 100})` }}
                  />

                  {/* Navigation */}
                  {currentIndex > 0 && (
                    <button
                      onClick={handlePrev}
                      className="absolute left-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                    >
                      <ChevronLeftIcon className="h-6 w-6" />
                    </button>
                  )}
                  {currentIndex < screenshots.length - 1 && (
                    <button
                      onClick={handleNext}
                      className="absolute right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                    >
                      <ChevronRightIcon className="h-6 w-6" />
                    </button>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setZoom(Math.max(50, zoom - 25))}
                      className="px-3 py-1 text-white/70 hover:text-white text-sm border border-white/20 rounded"
                    >
                      -
                    </button>
                    <span className="text-white text-sm w-16 text-center">{zoom}%</span>
                    <button
                      onClick={() => setZoom(Math.min(200, zoom + 25))}
                      className="px-3 py-1 text-white/70 hover:text-white text-sm border border-white/20 rounded"
                    >
                      +
                    </button>
                    <button
                      onClick={() => setZoom(100)}
                      className="px-3 py-1 text-white/70 hover:text-white text-sm border border-white/20 rounded"
                    >
                      Fit
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-white/70 text-sm">
                    <span>
                      {currentIndex + 1} of {screenshots.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-1 px-3 py-1 text-white/70 hover:text-white text-sm border border-white/20 rounded"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      Download
                    </button>
                  </div>
                </div>

                {/* Metadata */}
                {current.uploadedBy && (
                  <div className="mt-4 text-center text-white/50 text-xs">
                    Uploaded by {current.uploadedBy} on{' '}
                    {new Date(current.uploadedAt).toLocaleString()}
                    {current.width && current.height && (
                      <span className="ml-2">
                        ({current.width}x{current.height})
                      </span>
                    )}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export function ScreenshotGallery({
  screenshots,
  onUpload,
  compareMode = false,
}: ScreenshotGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState<ScreenshotCategory | 'all'>('all');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const filteredScreenshots =
    selectedCategory === 'all'
      ? screenshots
      : screenshots.filter((s) => s.category === selectedCategory);

  const categories: (ScreenshotCategory | 'all')[] = [
    'all',
    'before',
    'after',
    'feature',
    'bugfix',
    'ui',
    'database',
  ];

  const openViewer = (index: number) => {
    setCurrentImageIndex(index);
    setViewerOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload?.(e.target.files);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-fg">Screenshots ({screenshots.length})</h2>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              selectedCategory === cat
                ? 'bg-accent text-accent-fg border-accent'
                : cat === 'all'
                ? 'bg-bg-secondary text-muted border-border hover:border-accent'
                : CATEGORY_CONFIG[cat as ScreenshotCategory].color + ' hover:opacity-80'
            )}
          >
            {cat === 'all' ? 'All' : `${CATEGORY_CONFIG[cat].icon} ${CATEGORY_CONFIG[cat].label}`}
          </button>
        ))}
      </div>

      {/* Gallery Grid */}
      {filteredScreenshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <PhotoIcon className="h-12 w-12 text-muted mb-4" />
          <p className="text-muted mb-2">No screenshots uploaded yet</p>
          <p className="text-sm text-muted mb-4">
            Upload before/after or feature screenshots to help QA review
          </p>
          {onUpload && (
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-accent-fg rounded-lg hover:bg-accent-dark">
                <PlusIcon className="h-4 w-4" />
                Upload Screenshots
              </span>
            </label>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredScreenshots.map((screenshot, idx) => (
            <div
              key={screenshot.id}
              className="group relative aspect-video bg-bg-secondary rounded-lg overflow-hidden cursor-pointer border border-border hover:border-accent transition-colors"
              onClick={() => openViewer(idx)}
            >
              <img
                src={screenshot.thumbnailUrl || screenshot.url}
                alt={screenshot.description || 'Screenshot'}
                className="w-full h-full object-cover"
                loading="lazy"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <ArrowsPointingOutIcon className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Category Badge */}
              <span
                className={clsx(
                  'absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium',
                  CATEGORY_CONFIG[screenshot.category].color
                )}
              >
                {CATEGORY_CONFIG[screenshot.category].icon}
              </span>

              {/* Description */}
              {screenshot.description && (
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                  <p className="text-white text-xs truncate">{screenshot.description}</p>
                </div>
              )}
            </div>
          ))}

          {/* Upload Button */}
          {onUpload && (
            <label className="aspect-video bg-bg-secondary rounded-lg border-2 border-dashed border-border hover:border-accent transition-colors cursor-pointer flex flex-col items-center justify-center">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              <PlusIcon className="h-8 w-8 text-muted" />
              <span className="text-xs text-muted mt-2">Upload</span>
            </label>
          )}
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewerOpen && (
        <ImageViewer
          screenshots={filteredScreenshots}
          currentIndex={currentImageIndex}
          onClose={() => setViewerOpen(false)}
          onNavigate={setCurrentImageIndex}
        />
      )}
    </div>
  );
}
