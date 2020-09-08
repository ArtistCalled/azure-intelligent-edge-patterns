import React, { FC, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import {
  Dialog,
  DialogFooter,
  Stack,
  Text,
  Separator,
  mergeStyleSets,
  IDialogContentProps,
  IModalProps,
  DefaultButton,
  PrimaryButton,
} from '@fluentui/react';

import { State } from 'RootStateType';
import { LabelingType, WorkState } from './type';
import { closeLabelingPage, goPrevImage, goNextImage } from '../../store/labelingPageSlice';
import { selectImageEntities, saveLabelImageAnnotation } from '../../store/imageSlice';
import { labelPageAnnoSelector } from '../../store/annotationSlice';
import { Annotation } from '../../store/type';
import { selectPartEntities, Part } from '../../store/partSlice';
import { deleteImage } from '../../store/actions';
import Scene from './Scene';
import { PartPicker } from './PartPicker';
import { timeStampConverter } from '../../utils/timeStampConverter';

const getSelectedImageId = (state: State) => state.labelingPage.selectedImageId;
export const imageSelector = createSelector(
  [getSelectedImageId, selectImageEntities],
  (selectedImageId, imageEntities) => imageEntities[selectedImageId],
);
const imagePartSelector = createSelector([imageSelector, selectPartEntities], (img, partEntities) => {
  if (img) return partEntities[img.part];
  return { id: null, name: '', description: '' };
});

const selectImageTimeStamp = (state: State) => {
  const timeStampString = imageSelector(state)?.timestamp || '';
  return timeStampConverter(timeStampString);
};

const dialogContentProps: IDialogContentProps = {
  title: 'Image detail',
  subText: 'Drag a box around the object you want to tag',
  styles: { content: { width: '1080px' } },
};

const modalProps: IModalProps = {
  isBlocking: true,
  layerProps: {
    eventBubblingEnabled: true,
  },
};

const labelingPageStyle = mergeStyleSets({
  imgContainer: { position: 'relative', width: '70%', height: '540px', backgroundColor: '#F3F2F1' },
  imgInfoContainer: { width: '30%' },
});

export enum LabelPageMode {
  // Label a single image and closed. Used after capturing in camera details.
  SinglePage,
  // Able to label multi images. Used in image page and part page.
  MultiPage,
}

interface LabelingPageProps {
  mode: LabelPageMode;
}

const LabelingPage: FC<LabelingPageProps> = ({ mode = LabelingType.SingleAnnotation }) => {
  const dispatch = useDispatch();
  const imageIds = useSelector<State, number[]>((state) => state.labelingPage.imageIds);
  const selectedImageId = useSelector<State, number>((state) => state.labelingPage.selectedImageId);
  const index = imageIds.findIndex((e) => e === selectedImageId);
  const imageUrl = useSelector<State, string>((state) => imageSelector(state)?.image || '');
  const imgIsRelabel = useSelector<State, boolean>((state) => !!imageSelector(state)?.isRelabel);
  const imageConfidenceLevel = useSelector<State, number>((state) => imageSelector(state)?.confidence || 0);
  const imageTimeStamp = useSelector<State, string>(selectImageTimeStamp);
  const imgPart = useSelector<State, Part>(imagePartSelector);
  const closeDialog = () => dispatch(closeLabelingPage());
  const [workState, setWorkState] = useState<WorkState>(WorkState.None);
  const [loading, setLoading] = useState(false);

  const annotations = useSelector<State, Annotation[]>(labelPageAnnoSelector);

  const isOnePointBox = checkOnePointBox(annotations);

  const saveAnno = async () => {
    setLoading(true);
    await dispatch(saveLabelImageAnnotation());
    setLoading(false);
  };
  const saveAndNext = async () => {
    await saveAnno();
    dispatch(goNextImage());
  };
  const saveAndPrev = async () => {
    await saveAnno();
    dispatch(goPrevImage());
  };
  const saveAndDone = async () => {
    await saveAnno();
    closeDialog();
  };

  const onDeleteImage = async () => {
    setLoading(true);
    await dispatch(deleteImage(selectedImageId));
    setLoading(false);
  };

  const onRenderImage = (): JSX.Element => (
    <>
      <Scene
        url={imageUrl}
        annotations={annotations}
        workState={workState}
        setWorkState={setWorkState}
        labelingType={LabelingType.SingleAnnotation}
        onBoxCreated={() => {}}
        imgPart={imgPart}
      />
      <Text variant="small" styles={{ root: { position: 'absolute', right: 5, bottom: 5 } }}>
        {imageTimeStamp}
      </Text>
    </>
  );

  const onRenderPrediction = (): JSX.Element => {
    if (!imgIsRelabel) return null;
    return (
      <>
        <Stack>
          <Text styles={{ root: { fontWeight: 'bold' } }}>Predictions</Text>
          <Text>
            This object was identified as a <b>{imgPart?.name}</b> with{' '}
            <b>{(imageConfidenceLevel * 100).toFixed(2)}% confidence</b>.
          </Text>
        </Stack>
        <Separator styles={{ root: { width: 70, alignSelf: 'center' } }} />
      </>
    );
  };

  const onRenderInfoOnRight = (): JSX.Element => (
    <>
      {onRenderPrediction()}
      <PartPicker selectedPart={imgPart?.id} />
    </>
  );

  const onRenderFooter = (): JSX.Element => {
    const noPart = imgPart === null || imgPart === undefined;
    const noAnno = annotations.length === 0;
    const deleteDisabled = loading;
    const saveDisabled = noPart || noAnno;

    if (mode === LabelPageMode.SinglePage)
      return (
        <Stack horizontal tokens={{ childrenGap: 10 }}>
          <PrimaryButton
            text="Save and close"
            style={{ marginLeft: 'auto' }}
            onClick={saveAndDone}
            disabled={saveDisabled}
          />
          <DefaultButton text="Delete Image" onClick={onDeleteImage} disabled={deleteDisabled} />
          <DefaultButton text="Close" onClick={closeDialog} />
        </Stack>
      );

    const isLastImg = index === imageIds.length - 1;
    const previousDisabled = index === 0 || workState === WorkState.Creating || isOnePointBox || loading;
    const nextDisabled =
      isLastImg || noPart || noAnno || workState === WorkState.Creating || isOnePointBox || loading;
    return (
      <Stack horizontal tokens={{ childrenGap: 10 }}>
        <DefaultButton text="Delete Image" onClick={onDeleteImage} disabled={deleteDisabled} />
        <DefaultButton
          text="Previous"
          style={{ marginLeft: 'auto' }}
          onClick={saveAndPrev}
          disabled={previousDisabled}
        />
        <PrimaryButton text="Next" disabled={nextDisabled} onClick={saveAndNext} />
        <Separator vertical />
        <DefaultButton text="Done" primary={isLastImg} onClick={saveAndDone} />
      </Stack>
    );
  };

  return (
    <Dialog
      dialogContentProps={dialogContentProps}
      hidden={selectedImageId === null}
      onDismiss={closeDialog}
      modalProps={modalProps}
      // Remove the default max-width
      maxWidth={9999}
    >
      <Stack horizontal tokens={{ childrenGap: '24px' }}>
        <Stack verticalAlign="center" className={labelingPageStyle.imgContainer}>
          {onRenderImage()}
        </Stack>
        <Stack tokens={{ childrenGap: 20 }} className={labelingPageStyle.imgInfoContainer}>
          {onRenderInfoOnRight()}
        </Stack>
      </Stack>
      <DialogFooter>{onRenderFooter()}</DialogFooter>
    </Dialog>
  );
};

const checkOnePointBox = (annotations: Annotation[]): boolean => {
  if (annotations.length === 0) return false;
  const { label } = annotations[annotations.length - 1];
  return label.x1 === label.x2 && label.y1 === label.y2;
};

export default LabelingPage;
