<script setup lang="ts">
import { useForm } from 'vee-validate';

interface FormValues {
  username: string;
  email: string;
}

useForm<FormValues>({
  initialValues: {
    username: '',
    email: '',
  },
});
</script>
