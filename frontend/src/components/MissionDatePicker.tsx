import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw, Monitor, AlertTriangle, Rocket } from 'lucide-react';

export interface MissionDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  align?: 'left' | 'right';
  iconPosition?: 'left' | 'right';
  showUtcBadge?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// Reference epochs
const ARTEMIS_III_EPOCH = '2026-10-14';
const FUTURE_MISSION_EPOCH = '2027-03-15';
const APOLLO_11_EPOCH = '1969-07-20';

/**
 * Validates any raw date string against Gregorian calendar rules and SPICE ephemeris limits.
 * Prevents JavaScript Date automatic rollover (e.g., Feb 30 rolling to Mar 2).
 */
export function validateDateInput(
  rawStr: string,
  minStr = '1900-01-01',
  maxStr = '2050-01-01'
): { isValid: boolean; normalized?: string; error?: string } {
  const trimmed = rawStr.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Date is required (format: YYYY-MM-DD)' };
  }

  // Normalize separators: accept '-', '/', '.'
  const normalizedSep = trimmed.replace(/[\/\.]/g, '-');
  const match = normalizedSep.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    return { isValid: false, error: 'Invalid format. Use YYYY-MM-DD (e.g. 2027-03-15)' };
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) {
    return { isValid: false, error: `Invalid month (${month}). Must be 01–12` };
  }

  // Days in month calculation (UTC)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) {
    return {
      isValid: false,
      error: `Invalid day (${day}) for ${MONTH_NAMES[month - 1]} ${year} (max ${daysInMonth} days)`,
    };
  }

  const normalized = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

  if (minStr && normalized < minStr) {
    return {
      isValid: false,
      normalized,
      error: `Date is earlier than SPICE ephemeris coverage (${minStr})`,
    };
  }

  if (maxStr && normalized > maxStr) {
    return {
      isValid: false,
      normalized,
      error: `Date is beyond NASA SPICE DE440 coverage (${maxStr})`,
    };
  }

  return { isValid: true, normalized };
}

export const MissionDatePicker: React.FC<MissionDatePickerProps> = ({
  value,
  onChange,
  className = '',
  inputClassName = '',
  placeholder = 'YYYY-MM-DD',
  min = '1900-01-01',
  max = '2050-01-01',
  disabled = false,
  align = 'left',
  iconPosition = 'left',
  showUtcBadge = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [inputError, setInputError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  // Parse initial year and month
  const getParsedDate = (val: string): { year: number; month: number } => {
    const res = validateDateInput(val, '', '');
    if (res.isValid && res.normalized) {
      const parts = res.normalized.split('-').map(Number);
      return { year: parts[0], month: parts[1] - 1 };
    }
    return { year: 2026, month: 9 }; // Oct 2026 fallback
  };

  const parsedInitial = getParsedDate(value);
  const [viewYear, setViewYear] = useState(parsedInitial.year);
  const [viewMonth, setViewMonth] = useState(parsedInitial.month);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nativeDateInputRef = useRef<HTMLInputElement>(null);

  // Sync internal text state whenever value prop updates from outside, UNLESS user is actively typing
  useEffect(() => {
    if (!isFocused) {
      setInputValue(value || '');
      const valid = validateDateInput(value || '', min, max);
      if (valid.isValid && valid.normalized) {
        const parts = valid.normalized.split('-').map(Number);
        setViewYear(parts[0]);
        setViewMonth(parts[1] - 1);
        setInputError(null);
      }
    }
  }, [value, isFocused, min, max]);

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

    // If user has entered a full 10-char date or normalized pattern, validate live
    const trimmed = val.trim();
    if (trimmed.length >= 10 || /^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})$/.test(trimmed)) {
      const validation = validateDateInput(trimmed, min, max);
      if (validation.isValid && validation.normalized) {
        setInputError(null);
        onChange(validation.normalized);
        const parts = validation.normalized.split('-').map(Number);
        setViewYear(parts[0]);
        setViewMonth(parts[1] - 1);
      } else if (validation.error) {
        setInputError(validation.error);
      }
    } else {
      // Clear error while actively typing partial date
      if (inputError && trimmed.length < 10) {
        setInputError(null);
      }
    }
  };

  // Validate on blur: do NOT silently reset; show meaningful error and keep user text
  const handleInputBlur = () => {
    setIsFocused(false);
    const trimmed = inputValue.trim();

    if (!trimmed) {
      setInputError('Date cannot be empty');
      return;
    }

    const validation = validateDateInput(trimmed, min, max);
    if (validation.isValid && validation.normalized) {
      setInputError(null);
      setInputValue(validation.normalized);
      onChange(validation.normalized);
      const parts = validation.normalized.split('-').map(Number);
      setViewYear(parts[0]);
      setViewMonth(parts[1] - 1);
    } else {
      setInputError(validation.error || 'Invalid date entered');
      // Intentionally preserve inputValue so the user can see what was entered and fix it
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
      setIsOpen(false);
    } else if (e.key === 'Escape') {
      setInputValue(value);
      setInputError(null);
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
      setViewYear((y) => Math.max(1900, y - 1));
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => Math.min(2050, y + 1));
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const selectDate = (year: number, month: number, day: number) => {
    const formatted = `${year.toString().padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const validation = validateDateInput(formatted, min, max);
    if (validation.isValid && validation.normalized) {
      setInputValue(validation.normalized);
      setInputError(null);
      onChange(validation.normalized);
      setIsOpen(false);
    } else {
      setInputError(validation.error || 'Selected date is outside valid coverage');
    }
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
      } catch {
        setIsOpen(true);
      }
    }
  };

  const todayIso = new Date().toISOString().split('T')[0];

  return (
    <div ref={containerRef} className={`relative flex flex-col w-full min-w-0 ${className}`}>
      {/* Visual Text & Calendar Button Container */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={`flex items-center w-full ${inputClassName ? inputClassName : 'h-8 sm:h-8.5 bg-black border-white/20 hover:border-white/40'} border px-2.5 gap-2 transition-all cursor-pointer rounded-none ${
          inputError
            ? 'border-red-500/70 ring-1 ring-red-500/30'
            : isOpen
            ? 'border-[#58D8D0] ring-1 ring-[#58D8D0]/30'
            : ''
        }`}
      >
        {/* Calendar Trigger Icon Button ON THE LEFT */}
        {iconPosition === 'left' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) setIsOpen((prev) => !prev);
            }}
            disabled={disabled}
            title="Open interactive calendar"
            className="text-white/50 hover:text-[#58D8D0] transition-colors flex items-center justify-center shrink-0 cursor-pointer focus:outline-none p-0"
          >
            <CalendarIcon size={14} className={isOpen ? 'text-[#58D8D0]' : inputError ? 'text-red-400' : ''} />
          </button>
        )}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent p-0 text-white font-mono text-[11px] sm:text-xs tabular-nums outline-none placeholder:text-white/30 tracking-tight disabled:opacity-50 select-text"
        />

        {showUtcBadge && value && !inputError && (
          <span className="text-[9px] font-mono px-1 py-0.2 bg-[#58D8D0]/10 text-[#58D8D0] border border-[#58D8D0]/30 shrink-0 uppercase tracking-widest hidden sm:inline-block">
            UTC
          </span>
        )}

        {/* Calendar Trigger Icon Button ON THE RIGHT */}
        {iconPosition === 'right' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) setIsOpen((prev) => !prev);
            }}
            disabled={disabled}
            title="Open interactive calendar"
            className="text-white/70 hover:text-[#58D8D0] transition-colors flex items-center justify-center shrink-0 cursor-pointer focus:outline-none p-0.5 ml-1"
          >
            <CalendarIcon size={14} className={isOpen ? 'text-[#58D8D0]' : inputError ? 'text-red-400' : ''} />
          </button>
        )}
      </div>

      {/* Meaningful Validation Error Feedback */}
      {inputError && (
        <div className="flex items-center gap-1.5 px-2 py-1 mt-1 bg-red-950/70 border border-red-500/50 text-red-300 font-mono text-[10px] leading-tight animate-in fade-in duration-200">
          <AlertTriangle size={11} className="text-red-400 shrink-0" />
          <span className="flex-1">{inputError}</span>
        </div>
      )}

      {/* Hidden Native Date Input for OS Picker Integration */}
      <input
        ref={nativeDateInputRef}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          if (e.target.value) {
            const validation = validateDateInput(e.target.value, min, max);
            if (validation.isValid && validation.normalized) {
              setInputValue(validation.normalized);
              setInputError(null);
              onChange(validation.normalized);
            }
          }
        }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Custom Aerospace Interactive Calendar Dropdown */}
      {isOpen && (
        <div
          className={`absolute z-50 top-full mt-1.5 ${align === 'right' ? 'right-0' : 'left-0'} w-80 max-w-[calc(100vw-2rem)] bg-[#08090C] border border-white/20 shadow-2xl p-3 text-white font-mono select-none`}
          style={{ backdropFilter: 'blur(12px)' }}
        >
          {/* Header: Month / Year Navigation */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
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
                className="bg-black border border-white/20 text-xs text-[#58D8D0] font-bold px-1.5 py-0.5 outline-none cursor-pointer"
              >
                {Array.from({ length: 151 }, (_, i) => 1900 + i).map((y) => (
                  <option key={y} value={y} className="bg-black text-white">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-white/40 font-bold uppercase mb-1">
            {WEEKDAY_NAMES.map((day) => (
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
                  className="py-1.5 text-white/20 hover:bg-white/5 hover:text-white/60 text-[11px] transition-colors cursor-pointer"
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
                  className={`py-1.5 text-xs transition-all flex items-center justify-center relative cursor-pointer ${
                    isSelected
                      ? 'bg-[#58D8D0] text-black font-bold shadow-md shadow-[#58D8D0]/30'
                      : 'hover:bg-white/10 hover:text-[#58D8D0] text-white/90'
                  }`}
                >
                  {dayNum}
                  {isToday && !isSelected && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#58D8D0]" />
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
                  className="py-1.5 text-white/20 hover:bg-white/5 hover:text-white/60 text-[11px] transition-colors cursor-pointer"
                >
                  {i + 1}
                </button>
              ));
            })()}
          </div>

          {/* Quick Presets & Utilities Footer */}
          <div className="mt-3 pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
            {/* Future Mission (2027-03-15) */}
            <button
              type="button"
              onClick={() => {
                const parts = FUTURE_MISSION_EPOCH.split('-').map(Number);
                selectDate(parts[0], parts[1] - 1, parts[2]);
                setViewYear(parts[0]);
                setViewMonth(parts[1] - 1);
              }}
              className="text-[#ECC068] hover:text-white flex items-center gap-1 transition-colors cursor-pointer font-bold"
              title="Set to Future Mission Date (2027-03-15)"
            >
              <Rocket size={10} />
              <span>Future 2027</span>
            </button>

            {/* Artemis III (2026-10-14) */}
            <button
              type="button"
              onClick={() => {
                const parts = ARTEMIS_III_EPOCH.split('-').map(Number);
                selectDate(parts[0], parts[1] - 1, parts[2]);
                setViewYear(parts[0]);
                setViewMonth(parts[1] - 1);
              }}
              className="text-white/70 hover:text-[#58D8D0] flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset to Artemis III Reference Epoch (2026-10-14)"
            >
              <RotateCcw size={10} />
              <span>Artemis III</span>
            </button>

            {/* Apollo 11 (1969-07-20) */}
            <button
              type="button"
              onClick={() => {
                const parts = APOLLO_11_EPOCH.split('-').map(Number);
                selectDate(parts[0], parts[1] - 1, parts[2]);
                setViewYear(parts[0]);
                setViewMonth(parts[1] - 1);
              }}
              className="text-white/50 hover:text-white transition-colors cursor-pointer"
              title="Apollo 11 Touchdown (1969-07-20)"
            >
              Apollo 11
            </button>

            {/* Today */}
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                selectDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
                setViewYear(d.getUTCFullYear());
                setViewMonth(d.getUTCMonth());
              }}
              className="text-white/60 hover:text-[#58D8D0] transition-colors cursor-pointer"
            >
              Today
            </button>

            {/* Native OS Picker */}
            <button
              type="button"
              onClick={openNativePicker}
              className="text-white/40 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
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
