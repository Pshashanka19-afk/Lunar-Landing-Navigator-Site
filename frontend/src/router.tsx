import React, { createContext, useContext, useState, useEffect } from 'react';

export type RoutePath = 
  | '/'
  | '/space-observer'
  | '/mission-browser'
  | '/mission-planner'
  | '/route-planner'
  | '/scenario-comparison'
  | '/scientific-lab'
  | '/system-diagnostics';

interface RouterContextType {
  currentPath: string;
  search: string;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterContextType>({
  currentPath: '/',
  search: '',
  navigate: () => {},
});

export const useRouter = () => useContext(RouterContext);

export const normalizePath = (path: string): string => {
  // Strip trailing slashes unless root
  let clean = path.split('?')[0].split('#')[0] || '/';
  if (clean.length > 1 && clean.endsWith('/')) {
    clean = clean.slice(0, -1);
  }
  return clean || '/';
};

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return normalizePath(window.location.pathname);
    }
    return '/';
  });

  const [search, setSearch] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.search;
    }
    return '';
  });

  const navigate = (to: string) => {
    const target = normalizePath(to);
    const searchPart = to.includes('?') ? '?' + to.split('?')[1] : '';
    window.history.pushState({}, '', to);
    setCurrentPath(target);
    setSearch(searchPart);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(normalizePath(window.location.pathname));
      setSearch(window.location.search);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <RouterContext.Provider value={{ currentPath, search, navigate }}>
      {children}
    </RouterContext.Provider>
  );
};

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export const Link: React.FC<LinkProps> = ({ href, children, className, onClick, ...rest }) => {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e);
    
    // Only intercept local paths, ignore external URLs, modifier keys, or hash-only
    if (
      !e.defaultPrevented &&
      e.button === 0 && // left click
      !e.metaKey &&
      !e.ctrlKey &&
      !e.shiftKey &&
      !e.altKey &&
      href.startsWith('/')
    ) {
      e.preventDefault();
      navigate(href);
    }
  };

  return (
    <a href={href} onClick={handleClick} className={className} {...rest}>
      {children}
    </a>
  );
};
