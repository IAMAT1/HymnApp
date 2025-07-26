import { Router } from 'express';
import { db } from '../db';
import { profiles, insertProfileSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Create or update user profile after OAuth authentication
router.post('/profile', async (req, res) => {
  try {
    if (!db) {
      console.warn('Database not available - profile creation skipped');
      return res.json({ message: 'Profile creation skipped - database not configured' });
    }

    const profileData = insertProfileSchema.parse(req.body);
    
    // Check if profile already exists
    const existingProfile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileData.id))
      .limit(1);

    if (existingProfile.length > 0) {
      // Update existing profile
      const [updatedProfile] = await db
        .update(profiles)
        .set({
          email: profileData.email,
          fullName: profileData.fullName,
          avatarUrl: profileData.avatarUrl,
          provider: profileData.provider,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, profileData.id))
        .returning();

      res.json(updatedProfile);
    } else {
      // Create new profile
      const [newProfile] = await db
        .insert(profiles)
        .values(profileData)
        .returning();

      res.json(newProfile);
    }
  } catch (error) {
    console.error('Error creating/updating profile:', error);
    res.status(500).json({ error: 'Failed to create/update profile' });
  }
});

// Get user profile
router.get('/profile/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { id } = req.params;
    
    const profile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);

    if (profile.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profile[0]);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;