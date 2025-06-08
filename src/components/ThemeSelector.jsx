// ThemeSelector.jsx
import { useTheme } from '../context/ThemeContext';

function ThemeSelector() {
  const { theme, changeTheme, themes } = useTheme();

  return (
    <div className="w-full max-w-6xl mx-auto mt-12">
      <h2 className="text-2xl font-semibold text-foreground mb-6 text-center">
        Choose Your Theme
      </h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Object.entries(themes).map(([key, themeData]) => (
          <button
            key={key}
            onClick={() => changeTheme(key)}
            className={`
              relative p-4 rounded-lg border-2 transition-all duration-200
              ${theme === key 
                ? 'border-primary shadow-lg scale-105' 
                : 'border-border hover:border-primary/50 hover:shadow-md'
              }
            `}
          >
            {/* Theme preview */}
            <div className="mb-3 h-20 rounded overflow-hidden border border-border">
              <div 
                className="h-1/3" 
                style={{ backgroundColor: themeData.colors.primary }}
              />
              <div 
                className="h-2/3 flex"
              >
                <div 
                  className="w-1/2" 
                  style={{ backgroundColor: themeData.colors.background }}
                />
                <div 
                  className="w-1/2" 
                  style={{ backgroundColor: themeData.colors.card }}
                />
              </div>
            </div>
            
            {/* Theme name */}
            <p className="text-sm font-medium text-foreground">
              {themeData.name}
            </p>
            
            {/* Active indicator */}
            {theme === key && (
              <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ThemeSelector;