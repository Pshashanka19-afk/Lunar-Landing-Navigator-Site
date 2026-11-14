import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw, Monitor } from 'lucide-react';

export interface MissionDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  className?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// Standard Artemis III reference epoch
const ARTEMIS_III_EPOCH = '2026-10-14';

export const MissionDatePicker: React.FC<MissionDatePickerProps> = ({
  value,
  onChange,
  className = '',
  placeholder = 'YYYY-MM-DD',
  min = '2024-01-01',
  max = '2035-12-31',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');

  // Year and month currently being viewed in the dropdown calendar
  const initialDate = value && !isNaN(new Date(value + 'T00:00:00Z').getTime())
    ? new Date(value + 'T00:00:00Z')
    : new Date('2026-10-14T00:00:00Z');

  const [viewYear, setViewYear] = useState(initialDate.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getUTCMonth());

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nativeDateInputRef = useRef<HTMLInputElement>(null);

  // Sync internal text state whenever value prop updates from outside
  useEffect(() => {
    setInputValue(value || '');
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(value + 'T00:00:00Z');
      if (!isNaN(d.getTime())) {
        setViewYear(d.getUTCFullYear());
        setViewMonth(d.getUTCMonth());
      }
    }
  }, [value]);

  // Click outside to dismiss calendar popup
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle typing & backspacing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // If user typed/backspaced to a valid YYYY-MM-DD, emit it live
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const parsed = new Date(val + 'T00:00:00Z');
      if (!isNaN(parsed.getTime())) {
        onChange(val);
        setViewYear(parsed.getUTCFullYear());
        setViewMonth(parsed.getUTCMonth());
      }
    }
  };

  // Validate on blur: if user left partial or invalid date, restore valid value or normalize
  const handleInputBlur = () => {
    const trimmed = inputValue.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const d = new Date(trimmed + 'T00:00:00Z');
      if (!isNaN(d.getTime())) {
        onChange(trimmed);
        return;
      }
    }

    // Attempt normalizing formats like 2026/10/14 or 2026.10.14
    const normalized = trimmed.replace(/[\/\.]/g, '-');
    const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
      const formatted = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      const d = new Date(formatted + 'T00:00:00Z');
      if (!isNaN(d.getTime())) {
        setInputValue(formatted);
        onChange(formatted);
        return;
      }
    }

    // Revert to known valid prop value if invalid
    setInputValue(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
      setIsOpen(false);
    } else if (e.key === 'Escape') {
      setInputValue(value);
      setIsOpen(false);
    }
  };

  // Calendar math
  const daysInCurrentMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
  const daysInPrevMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
  const firstDayOfWeek = (new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay() + 6) % 7; // Monday = 0

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const selectDate = (year: number, month: number, day: number) => {
    const formatted = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setInputValue(formatted);
    onChange(formatted);
    setIsOpen(false);
  };

  // Trigger OS-level native date picker if supported
  const openNativePicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nativeDateInputRef.current) {
      try {
        if ('showPicker' in HTMLInputElement.prototype) {
          nativeDateInputRef.current.showPicker();
        } else {
          nativeDateInputRef.current.focus();
        }
      } catch (err) {
        // Fallback: toggle custom picker
        setIsOpen(true);
      }
    }
  };

  const todayIso = new Date().toISOString().split('T')[0];

  return (
    <div ref={containerRef} className={`relative inline-block w-full min-w-0 ${className}`}>
      {/* Visual Text & Calendar Button Container */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={`flex items-center w-full h-8 sm:h-8.5 bg-black border rounded-lg px-1.5 gap-1 transition-all cursor-pointer ${
          isOpen ? 'border-[#FFFFFF] ring-1 ring-[#FFFFFF]/30' : 'border-white/20 hover:border-white/40'
        }`}
      >
        {/* Calendar Trigger Icon Button ON THE LEFT */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setIsOpen(prev => !prev);
          }}
          disabled={disabled}
          title="Open interactive calendar (or click text to type/backspace)"
          className="text-white/50 hover:text-[#FFFFFF] transition-colors flex items-center justify-center shrink-0 cursor-pointer focus:outline-none p-0"
        >
          <CalendarIcon size={13} className={isOpen ? 'text-[#FFFFFF]' : ''} />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent p-0 text-white font-mono text-[11px] outline-none placeholder:text-white/30 tracking-tight disabled:opacity-50"
        />
      </div>

      {/* Hidden Native Date Input for OS Picker Integration */}
      <input
        ref={nativeDateInputRef}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          if (e.target.value) {
            setInputValue(e.target.value);
            onChange(e.target.value);
          }
        }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Custom Aerospace Interactive Calendar Dropdown */}
      {isOpen && (
        <div
          className="absolute z-50 top-full mt-1.5 left-0 w-72 max-w-[calc(100vw-2rem)] bg-[#08090C] border border-white/20 shadow-2xl p-3 text-white font-mono select-none"
          style={{ backdropFilter: 'blur(12px)' }}
        >
          {/* Header: Month / Year Navigation */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="Previous Month"
            >
              <ChevronLeft size={14} />
            </button>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white tracking-wider uppercase">
                {MONTH_NAMES[viewMonth]}
              </span>
              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value))}
                className="bg-black border border-white/20 text-xs text-[#FFFFFF] font-bold px-1 py-0.5 outline-none cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => 2024 + i).map(y => (
                  <option key={y} value={y} className="bg-black text-white">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="Next Month"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-white/40 font-bold uppercase mb-1">
            {WEEKDAY_NAMES.map(day => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {/* Trailing days of previous month */}
            {Array.from({ length: firstDayOfWeek }, (_, i) => {
              const dayNum = daysInPrevMonth - firstDayOfWeek + i + 1;
              const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
              const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
              return (
                <button
                  key={`prev-${i}`}
                  type="button"
                  onClick={() => selectDate(prevYear, prevMonth, dayNum)}
                  className="py-1.5 text-white/20 hover:bg-white/5 hover:text-white/60 text-[11px] transition-colors"
                >
                  {dayNum}
                </button>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: daysInCurrentMonth }, (_, i) => {
              const dayNum = i + 1;
              const dateIso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isSelected = dateIso === value;
              const isToday = dateIso === todayIso;

              return (
                <button
                  key={`cur-${dayNum}`}
                  type="button"
                  onClick={() => selectDate(viewYear, viewMonth, dayNum)}
                  className={`py-1.5 text-xs transition-all flex items-center justify-center relative ${
                    isSelected
                      ? 'bg-[#FFFFFF] text-black font-bold shadow-md shadow-[#FFFFFF]/30'
                      : 'hover:bg-white/10 hover:text-[#FFFFFF] text-white/90'
                  }`}
                >
                  {dayNum}
                  {isToday && !isSelected && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#FFFFFF]" />
                  )}
                </button>
              );
            })}

            {/* Remaining empty cells to complete standard calendar rows */}
            {(() => {
              const totalCells = firstDayOfWeek + daysInCurrentMonth;
              const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
              const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
              const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;

              return Array.from({ length: remaining }, (_, i) => (
                <button
                  key={`next-${i}`}
                  type="button"
                  onClick={() => selectDate(nextYear, nextMonth, i + 1)}
                  className="py-1.5 text-white/20 hover:bg-white/5 hover:text-white/60 text-[11px] transition-colors"
                >
                  {i + 1}
                </button>
              ));
            })()}
          </div>

          {/* Quick Presets & Utilities Footer */}
          <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
            <button
              type="button"
              onClick={() => {
                setInputValue(ARTEMIS_III_EPOCH);
                onChange(ARTEMIS_III_EPOCH);
                setViewYear(2026);
                setViewMonth(9); // Oct is month index 9
                setIsOpen(false);
              }}
              className="text-white/60 hover:text-[#FFFFFF] flex items-center gap-1 transition-colors"
              title="Reset to Artemis III Reference Epoch (2026-10-14)"
            >
              <RotateCcw size={10} />
              <span>Artemis III</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setInputValue(todayIso);
                onChange(todayIso);
                const d = new Date();
                setViewYear(d.getUTCFullYear());
                setViewMonth(d.getUTCMonth());
                setIsOpen(false);
              }}
              className="text-white/60 hover:text-[#FFFFFF] transition-colors"
            >
              Today
            </button>

            <button
              type="button"
              onClick={openNativePicker}
              className="text-white/40 hover:text-white flex items-center gap-1 transition-colors"
              title="Open browser native calendar"
            >
              <Monitor size={10} />
              <span>Native</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default MissionDatePicker;

