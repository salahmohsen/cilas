"use-client";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { BasicInput, TipTapInput } from "@/components/form-inputs";
import { FormWrapper } from "@/components/form-inputs/form.wrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SafeUser } from "@/lib/drizzle/drizzle.types";
import { updateUserInfo } from "@/lib/users/users.actions";
import { BasePrevState } from "@/lib/users/users.actions.types";
import { uploadImage, UploadingFolder } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Trash2, UserCog, UserPen } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import profileSchema, {
  ProfileSchema,
} from "../../course-management/_lib/profile.schema";

type UserSettingsFormProps = {
  user: SafeUser;
  open: boolean;
  onOpenChange: (value: boolean) => void;
};
export const UserSettingsForm = ({ user, open, onOpenChange }: UserSettingsFormProps) => {
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const formMethods = useForm<ProfileSchema>({
    resolver: zodResolver(profileSchema.schema),
    defaultValues: profileSchema.defaults(user),
    mode: "onChange",
  });

  const { watch, setValue } = formMethods;

  const avatarValue = watch("avatar");

  const imageInput = useRef<HTMLInputElement>(null);

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
        <FormWrapper<ProfileSchema, BasePrevState>
          formMethods={formMethods}
          serverAction={updateUserInfo}
          onSuccess={() => {
            onOpenChange(false);
          }}
          className="space-y-5 *:space-y-4"
        >
          {({ isPending }) => {
            return (
              <>
                <input name="id" value={user?.id} hidden readOnly />
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
                  <div className="flex items-center gap-4">
                    {user && (
                      <Avatar
                        user={{ ...user, avatar: avatarValue ?? null }}
                        className="h-36 w-36"
                      />
                    )}
                    <div className="flex gap-2">
                      <Button
                        icon={<ImagePlus />}
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          imageInput.current?.click();
                        }}
                      >
                        Change picture
                      </Button>
                      <Button
                        icon={<Trash2 />}
                        variant="destructive"
                        size="sm"
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
                </div>
                <div className="grid w-full grid-cols-2 gap-5">
                  <BasicInput<ProfileSchema, "firstName">
                    label="First name"
                    name="firstName"
                    type="text"
                    className="block"
                    placeholder="Type your first name..."
                  />
                  <BasicInput<ProfileSchema, "lastName">
                    label="Last name"
                    name="lastName"
                    type="text"
                    className="block"
                    placeholder="Type your last name..."
                  />
                </div>
                <BasicInput<ProfileSchema, "userName">
                  label="Username"
                  name="userName"
                  type="text"
                  placeholder="Type your username..."
                />
                <TipTapInput<ProfileSchema, "bio">
                  name="bio"
                  label="Bio"
                  className="col-span-5"
                  editorToolbar={false}
                  placeholder="Click here to start writing your bio..."
                />
                <BasicInput<ProfileSchema, "email">
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="Type your email..."
                />
                <BasicInput<ProfileSchema, "tel">
                  label="Tel"
                  name="tel"
                  type="tel"
                  placeholder="Type your telephone number..."
                />
                <DialogFooter className="mt-4">
                  <Button variant="secondary" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    isLoading={isPending}
                    disabled={
                      !formMethods.formState.isDirty ||
                      !formMethods.formState.isValid ||
                      isUploading
                    }
                  >
                    Save changes
                  </Button>
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
