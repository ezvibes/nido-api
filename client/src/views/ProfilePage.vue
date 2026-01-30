<template>
  <div class="profile-container">
    <h2>My Profile</h2>
    <div class="profile-picture-section">
      <img :src="photoURL" alt="Profile Picture" class="profile-picture" />
      <input type="file" @change="handleFileChange" accept="image/*" ref="fileInput" class="file-input" />
      <button @click="triggerFileInput" class="btn btn-secondary">Change Picture</button>
    </div>
    <form @submit.prevent="updateProfile" class="profile-form">
      <div class="form-group">
        <label for="name">Name</label>
        <input type="text" id="name" v-model="name" placeholder="Your name" />
      </div>
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" :value="user?.email" disabled />
      </div>
      <button type="submit" class="btn btn-primary">Update Profile</button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useAuth } from '../composables/useAuth';

const { user, updateUserProfile, updateProfilePicture } = useAuth();
const name = ref('');
const photoURL = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);

onMounted(() => {
  if (user.value) {
    name.value = user.value.displayName || '';
    photoURL.value = user.value.photoURL || 'https://via.placeholder.com/150';
  }
});

watch(user, (newUser) => {
  if (newUser) {
    name.value = newUser.displayName || '';
    photoURL.value = newUser.photoURL || 'https://via.placeholder.com/150';
  }
});

const updateProfile = () => {
  if (user.value) {
    updateUserProfile({
      displayName: name.value
    });
  }
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    selectedFile.value = target.files[0];
    uploadProfilePicture();
  }
};

const uploadProfilePicture = async () => {
  if (selectedFile.value) {
    await updateProfilePicture(selectedFile.value);
  }
};
</script>

<style scoped>
.profile-container {
  max-width: 500px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: var(--card-bg);
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  text-align: center;
}

.profile-picture-section {
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.profile-picture {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid var(--primary);
}

.file-input {
  display: none;
}

.profile-form {
  text-align: left;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.form-group input {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  box-sizing: border-box;
  background-color: var(--background);
  color: var(--text-dark);
}

.form-group input:disabled {
  background-color: #E5E7EB;
  cursor: not-allowed;
}

.btn {
  width: 100%;
  padding: 0.85rem 1.5rem;
  border: 1px solid transparent;
  border-radius: 9999px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  letter-spacing: 0.025em;
}

.btn-primary {
  background-color: var(--primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--primary-hover);
}

.btn-secondary {
  background-color: transparent;
  color: var(--primary);
  border: 1px solid var(--primary);
  width: auto;
}

.btn-secondary:hover {
  background-color: var(--primary);
  color: white;
}
</style>
