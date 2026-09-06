-- ==============================================================================
-- QMT-80 Hub : Schema Supabase (Tables, Row Level Security & Politiques d'accès)
-- Exécutez ce script dans l'éditeur SQL de votre projet Supabase (SQL Editor)
-- ==============================================================================

-- 1. Table des Profils Utilisateurs
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  display_name TEXT DEFAULT 'Athlète QMT',
  home_address TEXT,
  campus_address TEXT,
  trail_address TEXT,
  fc_max INT DEFAULT 203,
  race_name TEXT DEFAULT 'Québec Mega Trail 80 km (QMT-80)',
  race_date DATE DEFAULT '2027-07-03',
  ical_url TEXT,
  share_slug TEXT UNIQUE,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activation RLS sur les profils
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent lire et modifier UNIQUEMENT leur propre profil
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Les spectateurs peuvent voir UNIQUEMENT les profils dont 'is_public' est TRUE
CREATE POLICY "Spectators can view public profiles" 
  ON public.profiles FOR SELECT 
  USING (is_public = TRUE);

-- 2. Table des Activités Synchronisées (Garmin Connect / GPX)
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_id TEXT NOT NULL,
  name TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT,
  distance_km NUMERIC(6,2),
  elevation_gain_m INT,
  avg_hr INT,
  max_hr INT,
  avg_pace TEXT,
  calories INT,
  raw_payload JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_activity_unique UNIQUE (user_id, activity_id)
);

-- Activation RLS sur les activités
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own activities" 
  ON public.activities FOR ALL 
  USING (auth.uid() = user_id);

-- Les spectateurs peuvent lire les activités si le profil du propriétaire est public
CREATE POLICY "Spectators can read public activities" 
  ON public.activities FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE public.profiles.id = activities.user_id AND public.profiles.is_public = TRUE
    )
  );

-- 3. Table des Réglages Utilisateur (Appariements Manuels, etc.)
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  manual_pairs JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activation RLS sur user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own settings" 
  ON public.user_settings FOR ALL 
  USING (auth.uid() = user_id);

-- 4. Trigger automatique pour créer un profil dès qu'un utilisateur s'inscrit
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
