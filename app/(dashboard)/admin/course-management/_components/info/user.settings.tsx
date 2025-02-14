import { Avatar } from "@/components/avatar";
import { BasicInput, SubmitButton, TipTapInput } from "@/components/form-inputs";
import { FormWrapper } from "@/components/form-inputs/form.wrapper";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateUserInfo } from "@/lib/actions/users.actions";
import { useCourseStore } from "@/lib/store/course.slice";
import { userLocalInfo } from "@/lib/types/drizzle.types";
import { UserProfileSchema, userProfileSchema } from "@/lib/types/forms.schema";
import { BasePrevState } from "@/lib/types/users.actions.types";
import { uploadImage, UploadingFolder } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserCog, UserPen } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type UserSettingsProps = {
  user: userLocalInfo;
  courseId: number;
  open: boolean;
  onOpenChange: (value: boolean) => void;
};
export const UserSettings = ({
  user,
  courseId,
  open,
  onOpenChange,
}: UserSettingsProps) => {
  const { revalidateCourse } = useCourseStore();
  const formMethods = useForm<UserProfileSchema>({
    resolver: zodResolver(userProfileSchema.schema),
    defaultValues: userProfileSchema.defaults(user),
  });

  const { watch, setValue } = formMethods;

  const avatarValue = watch("avatar");
  const imageInput = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const toastId = toast.loading("Uploading...");
      const uploadedUrl = await uploadImage(file, UploadingFolder.avatar);
      if (uploadedUrl && typeof uploadedUrl === "string") {
        setValue("avatar", uploadedUrl, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });

        setIsUploading(false);
        toast.success("Avatar uploaded successfully!", { id: toastId });
      } else if (uploadedUrl instanceof Error) {
        setIsUploading(false);
        toast.error("failed uploading avatar!", { id: toastId });
        throw new Error(uploadedUrl.message);
      }
    } catch (error) {
      console.error("Upload error:", error);
    }
  };

  const getFallback = useCallback(() => {
    const firstNameChar = user.firstName?.slice(0, 1).toUpperCase() || "";
    const lastNameChar = user.lastName?.slice(0, 1).toUpperCase() || "";
    return firstNameChar || lastNameChar ? `${firstNameChar}${lastNameChar}` : "?";
  }, [user.firstName, user.lastName]);

  return (
    <Tabs defaultValue="profile" className="flex min-w-96" orientation="vertical">
      <TabsList className="fixed my-0 flex h-full w-1/4 flex-col items-start justify-start overflow-hidden rounded-r-none border-r p-0 px-0 *:flex *:w-full *:cursor-pointer *:justify-start *:gap-3 *:rounded-none *:px-5 *:py-3">
        <TabsTrigger value="profile">
          <UserPen />
          <span>Profile</span>
        </TabsTrigger>
        <TabsTrigger value="settings">
          <UserCog />
          <span>Account</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="profile" className="m-8 ml-[25%] w-full pl-5">
        <FormWrapper<UserProfileSchema, BasePrevState>
          formMethods={formMethods}
          serverAction={updateUserInfo}
          onSuccess={() => {
            revalidateCourse(courseId);
            onOpenChange(false);
          }}
          className="space-y-5 *:space-y-4"
        >
          {({ isPending }) => {
            return (
              <>
                <input name="id" value={user.id} hidden readOnly />
                <input name="avatar" value={avatarValue || ""} hidden readOnly />
                <input
                  className="hidden"
                  ref={imageInput}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif"
                  onChange={onFileChange}
                />
                <div>
                  <p className="text-muted-foreground text-sm font-bold">
                    Profile picture
                  </p>
                  <div className="flex items-center gap-5">
                    <Avatar
                      avatar={user.avatar || undefined}
                      alt={`${user.firstName} ${user.lastName}`}
                      fallback={getFallback()}
                      className="h-36 w-36"
                    />
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        imageInput.current?.click();
                      }}
                    >
                      Change picture
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        setValue("avatar", "", {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                      }}
                    >
                      Delete picture
                    </Button>
                  </div>
                </div>
                <div className="grid w-full grid-cols-2 gap-5">
                  <BasicInput<UserProfileSchema, "firstName">
                    label="First name"
                    name="firstName"
                    type="text"
                    className="block"
                    placeholder="Type your first name..."
                  />
                  <BasicInput<UserProfileSchema, "lastName">
                    label="Last name"
                    name="lastName"
                    type="text"
                    className="block"
                    placeholder="Type your last name..."
                  />
                </div>
                <BasicInput<UserProfileSchema, "userName">
                  label="Username"
                  name="userName"
                  type="text"
                  placeholder="Type your username..."
                />
                <TipTapInput<UserProfileSchema, "bio">
                  name="bio"
                  label="Bio"
                  className="col-span-5"
                  editorToolbar={false}
                  placeholder="Click here to start writing your bio..."
                />
                <BasicInput<UserProfileSchema, "email">
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="Type your email..."
                />
                <BasicInput<UserProfileSchema, "tel">
                  label="Tel"
                  name="tel"
                  type="tel"
                  placeholder="Type your telephone number..."
                />
                <DialogFooter className="mt-4">
                  <Button variant="secondary" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <SubmitButton
                    isLoading={isPending}
                    disabled={
                      !formMethods.formState.isDirty ||
                      !formMethods.formState.isValid ||
                      isUploading
                    }
                  >
                    Save changes
                  </SubmitButton>
                </DialogFooter>
              </>
            );
          }}
        </FormWrapper>
      </TabsContent>
      <TabsContent value="settings" className="m-8 ml-[25%] w-full pl-5">
        Change your password here.
      </TabsContent>
    </Tabs>
  );
};
