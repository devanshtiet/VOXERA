"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/db/server";

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { data: signUpData, error } = await supabase.auth.signUp(data);

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (signUpData.session) {
    revalidatePath("/", "layout");
    redirect("/onboarding");
  }

  redirect(
    "/login?message=" +
      encodeURIComponent("Check your email to confirm your account, then sign in.")
  );
}
